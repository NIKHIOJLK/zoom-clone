"""Real-time layer: one WebSocket per participant in a meeting.

The server pushes events instead of clients polling:
  {"type": "participants", "participants": [...], "online": [ids]}   who is in the room
  {"type": "message", "message": {...}}                              new chat message
  {"type": "removed"}                                                you were removed (sent to one person)
  {"type": "ended"}                                                  the meeting is over
  {"type": "signal", "from": id, "data": {...}}                      WebRTC offer/answer/ICE, relayed peer to peer

Clients send:
  {"type": "signal", "to": id, "data": {...}}                        relay to another participant
  {"type": "ping"}                                                   keep-alive
"""
import asyncio

import anyio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .database import SessionLocal
from .models import Meeting, Participant, utcnow
from .schemas import ParticipantOut

# A closed socket (tab closed, network drop) only counts as "left" if the person
# doesn't reconnect within this many seconds, so a page refresh doesn't kick them out.
RECONNECT_GRACE_SECONDS = 10

router = APIRouter(tags=["realtime"])


class ConnectionManager:
    """Keeps the open sockets, grouped by meeting code: {code: {participant_id: WebSocket}}."""

    def __init__(self) -> None:
        self.rooms: dict[str, dict[int, WebSocket]] = {}

    async def connect(self, code: str, participant_id: int, ws: WebSocket) -> None:
        room = self.rooms.setdefault(code, {})
        old = room.get(participant_id)
        room[participant_id] = ws
        if old is not None:  # same person opened a second socket: keep the newest
            try:
                await old.close(code=4000)
            except Exception:
                pass

    def disconnect(self, code: str, participant_id: int, ws: WebSocket) -> None:
        room = self.rooms.get(code, {})
        if room.get(participant_id) is ws:
            del room[participant_id]
        if not room:
            self.rooms.pop(code, None)

    def online(self, code: str) -> list[int]:
        return list(self.rooms.get(code, {}))

    def is_online(self, code: str, participant_id: int) -> bool:
        return participant_id in self.rooms.get(code, {})

    async def send(self, code: str, participant_id: int, message: dict) -> None:
        ws = self.rooms.get(code, {}).get(participant_id)
        if ws is None:
            return
        try:
            await ws.send_json(message)
        except Exception:
            pass  # socket is closing; its own handler cleans up

    async def broadcast(self, code: str, message: dict) -> None:
        for participant_id in list(self.rooms.get(code, {})):
            await self.send(code, participant_id, message)


manager = ConnectionManager()
_background: set[asyncio.Task] = set()  # keep references so pending tasks aren't garbage-collected


# ---------------------------------------------------------------- events

def _active(meeting: Meeting) -> list[Participant]:
    return [p for p in meeting.participants if p.left_at is None and not p.is_removed]


async def broadcast_participants(code: str) -> None:
    """Send the current participant list (and who is connected) to everyone in the room."""
    if not manager.online(code):
        return
    db = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.meeting_code == code).first()
        if meeting is None:
            return
        people = [ParticipantOut.model_validate(p).model_dump(mode="json") for p in _active(meeting)]
    finally:
        db.close()
    await manager.broadcast(code, {"type": "participants", "participants": people, "online": manager.online(code)})


def notify(coro_fn, *args) -> None:
    """Run an async broadcast from a normal (sync) endpoint.

    FastAPI runs `def` endpoints in a worker thread; anyio.from_thread.run hops back to the
    event loop, runs the coroutine there and waits for it. Outside a request (tests, scripts)
    there is no loop to hop to, so we simply skip the push.
    """
    try:
        anyio.from_thread.run(coro_fn, *args)
    except RuntimeError:
        pass


# ---------------------------------------------------------------- socket endpoint

@router.websocket("/ws/meetings/{code}")
async def meeting_socket(ws: WebSocket, code: str, participant_id: int):
    db = SessionLocal()
    try:
        digits = "".join(ch for ch in code if ch.isdigit())
        meeting = db.query(Meeting).filter(Meeting.meeting_code == digits).first()
        participant = next((p for p in meeting.participants if p.id == participant_id), None) if meeting else None
        if meeting is None or participant is None or participant.is_removed or meeting.status == "ended":
            await ws.close(code=4404)
            return
        if participant.left_at is not None:  # came back after a refresh or network drop
            participant.left_at = None
            db.commit()
        code = meeting.meeting_code
    finally:
        db.close()

    await ws.accept()
    await manager.connect(code, participant_id, ws)
    await broadcast_participants(code)

    try:
        while True:
            msg = await ws.receive_json()
            if msg.get("type") == "signal" and isinstance(msg.get("to"), int):
                # WebRTC signaling: the server only relays; it never looks inside
                await manager.send(code, msg["to"], {"type": "signal", "from": participant_id, "data": msg.get("data")})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(code, participant_id, ws)
        await broadcast_participants(code)  # "online" changed, peers drop the video connection
        task = asyncio.create_task(_leave_if_gone(code, participant_id))
        _background.add(task)
        task.add_done_callback(_background.discard)


async def _leave_if_gone(code: str, participant_id: int) -> None:
    """After the grace period, a participant whose socket is still closed has left the meeting."""
    await asyncio.sleep(RECONNECT_GRACE_SECONDS)
    if manager.is_online(code, participant_id):
        return
    ended = False
    db = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.meeting_code == code).first()
        participant = next((p for p in meeting.participants if p.id == participant_id), None) if meeting else None
        if participant is None or participant.left_at is not None:
            return  # already left through the Leave button, or removed
        now = utcnow()
        participant.left_at = now
        if meeting.status == "live" and not _active(meeting):  # last one out ends the meeting
            meeting.status = "ended"
            meeting.ended_at = now
            ended = True
        db.commit()
    finally:
        db.close()
    if ended:
        await manager.broadcast(code, {"type": "ended"})
    else:
        await broadcast_participants(code)
