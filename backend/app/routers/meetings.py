"""Meeting endpoints: create, list, look up, join/leave, and host controls."""
import re
import secrets
import string
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..config import FRONTEND_URL
from ..database import get_db
from ..deps import get_current_user
from ..models import Meeting, Message, Participant, User, utcnow
from ..schemas import (
    InstantMeetingCreate,
    JoinRequest,
    MeetingOut,
    MessageCreate,
    MessageOut,
    ParticipantOut,
    ParticipantUpdate,
    ScheduleMeetingCreate,
)

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


# ---------------------------------------------------------------- helpers

def active_participants(meeting: Meeting) -> list[Participant]:
    """People currently in the meeting (joined, not left, not removed)."""
    return [p for p in meeting.participants if p.left_at is None and not p.is_removed]


def to_out(m: Meeting) -> MeetingOut:
    return MeetingOut(
        id=m.id,
        meeting_code=m.meeting_code,
        title=m.title,
        description=m.description or "",
        type=m.type,
        status=m.status,
        scheduled_start=m.scheduled_start,
        duration_minutes=m.duration_minutes,
        passcode=m.passcode,
        host_id=m.host_id,
        host_name=m.host.name,
        invite_link=f"{FRONTEND_URL}/join/{m.meeting_code}",
        participant_count=len(active_participants(m)),
        total_participants=len({p.display_name for p in m.participants}),
        created_at=m.created_at,
        started_at=m.started_at,
        ended_at=m.ended_at,
    )


def generate_code(db: Session) -> str:
    """Zoom-style 10-digit meeting ID, unique in the DB, never starting with 0."""
    while True:
        code = str(secrets.choice("123456789")) + "".join(secrets.choice(string.digits) for _ in range(9))
        if not db.query(Meeting.id).filter(Meeting.meeting_code == code).first():
            return code


def generate_passcode() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


def normalize_code(raw: str) -> str:
    """Accepts '847 291 6305', '847-291-6305' or '8472916305'."""
    return re.sub(r"\D", "", raw)


def get_meeting_or_404(db: Session, code: str) -> Meeting:
    meeting = db.query(Meeting).filter(Meeting.meeting_code == normalize_code(code)).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="This meeting ID is not valid. Please check and try again.")
    return meeting


def get_participant_or_404(meeting: Meeting, participant_id: int) -> Participant:
    for p in meeting.participants:
        if p.id == participant_id:
            return p
    raise HTTPException(status_code=404, detail="Participant not found.")


def end_meeting_now(meeting: Meeting) -> None:
    now = utcnow()
    for p in active_participants(meeting):
        p.left_at = now
    meeting.status = "ended"
    meeting.ended_at = now


# ---------------------------------------------------------------- create

@router.post("/instant", response_model=MeetingOut, status_code=201)
def create_instant_meeting(
    payload: InstantMeetingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    title = (payload.title or "").strip() or f"{user.name}'s Zoom Meeting"
    meeting = Meeting(
        meeting_code=generate_code(db),
        title=title,
        description="",
        host_id=user.id,
        type="instant",
        status="live",
        duration_minutes=40,
        passcode=generate_passcode(),
        started_at=utcnow(),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return to_out(meeting)


@router.post("/schedule", response_model=MeetingOut, status_code=201)
def schedule_meeting(
    payload: ScheduleMeetingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start = payload.scheduled_start
    if start.tzinfo is not None:  # convert "…Z" / "+05:30" input to naive UTC
        start = start.astimezone(timezone.utc).replace(tzinfo=None)
    if start < utcnow().replace(second=0, microsecond=0):
        raise HTTPException(status_code=422, detail="The start time must be in the future.")

    meeting = Meeting(
        meeting_code=generate_code(db),
        title=payload.title,
        description=payload.description.strip(),
        host_id=user.id,
        type="scheduled",
        status="scheduled",
        scheduled_start=start,
        duration_minutes=payload.duration_minutes,
        passcode=generate_passcode(),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return to_out(meeting)


# ---------------------------------------------------------------- lists
# These fixed paths must be declared before "/{code}" or FastAPI would treat
# "upcoming" as a meeting code.

@router.get("/upcoming", response_model=list[MeetingOut])
def upcoming_meetings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Scheduled meetings that have not finished yet, soonest first."""
    now = utcnow()
    meetings = (
        db.query(Meeting)
        .filter(
            Meeting.host_id == user.id,
            Meeting.type == "scheduled",
            Meeting.status.in_(["scheduled", "live"]),
        )
        .order_by(Meeting.scheduled_start.asc())
        .all()
    )
    # keep meetings whose scheduled window hasn't passed (start + duration > now)
    return [
        to_out(m)
        for m in meetings
        if m.status == "live" or m.scheduled_start + timedelta(minutes=m.duration_minutes) > now
    ]


@router.get("/recent", response_model=list[MeetingOut])
def recent_meetings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Ended meetings the user hosted or attended, most recent first."""
    attended = db.query(Participant.meeting_id).filter(Participant.user_id == user.id)
    meetings = (
        db.query(Meeting)
        .filter(
            Meeting.status == "ended",
            or_(Meeting.host_id == user.id, Meeting.id.in_(attended)),
        )
        .order_by(Meeting.ended_at.desc())
        .limit(10)
        .all()
    )
    return [to_out(m) for m in meetings]


# ---------------------------------------------------------------- single meeting

@router.get("/{code}", response_model=MeetingOut)
def get_meeting(code: str, db: Session = Depends(get_db)):
    """Used by Join to validate that a meeting exists before asking for a name."""
    return to_out(get_meeting_or_404(db, code))


@router.delete("/{code}", status_code=204)
def delete_meeting(code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Cancel a scheduled meeting (host only)."""
    meeting = get_meeting_or_404(db, code)
    if meeting.host_id != user.id:
        raise HTTPException(status_code=403, detail="Only the host can delete this meeting.")
    db.delete(meeting)
    db.commit()
    return Response(status_code=204)


@router.post("/{code}/join", response_model=ParticipantOut, status_code=201)
def join_meeting(code: str, payload: JoinRequest, db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(db, code)
    if meeting.status == "ended":
        raise HTTPException(status_code=410, detail="This meeting has ended.")

    is_host = payload.user_id is not None and payload.user_id == meeting.host_id
    participant = Participant(
        meeting_id=meeting.id,
        user_id=payload.user_id,
        display_name=payload.display_name,
        role="host" if is_host else "participant",
    )
    if meeting.status == "scheduled":  # first join starts a scheduled meeting
        meeting.status = "live"
        meeting.started_at = utcnow()
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


@router.get("/{code}/participants", response_model=list[ParticipantOut])
def list_participants(code: str, db: Session = Depends(get_db)):
    """Everyone currently in the meeting. The room polls this every few seconds."""
    return active_participants(get_meeting_or_404(db, code))


@router.get("/{code}/participants/{participant_id}", response_model=ParticipantOut)
def get_participant(code: str, participant_id: int, db: Session = Depends(get_db)):
    """Lets a client check its own state (e.g. whether the host removed or muted it)."""
    return get_participant_or_404(get_meeting_or_404(db, code), participant_id)


@router.patch("/{code}/participants/{participant_id}", response_model=ParticipantOut)
def update_participant(code: str, participant_id: int, payload: ParticipantUpdate, db: Session = Depends(get_db)):
    """Toggle your own mic / camera state."""
    participant = get_participant_or_404(get_meeting_or_404(db, code), participant_id)
    if payload.is_muted is not None:
        participant.is_muted = payload.is_muted
    if payload.is_video_on is not None:
        participant.is_video_on = payload.is_video_on
    db.commit()
    db.refresh(participant)
    return participant


@router.post("/{code}/participants/{participant_id}/leave")
def leave_meeting(code: str, participant_id: int, db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(db, code)
    participant = get_participant_or_404(meeting, participant_id)
    if participant.left_at is None:
        participant.left_at = utcnow()
    # last person out ends the meeting, which moves it to "Recent"
    if meeting.status == "live" and not active_participants(meeting):
        end_meeting_now(meeting)
    db.commit()
    return {"status": meeting.status}


# ---------------------------------------------------------------- chat

@router.get("/{code}/messages", response_model=list[MessageOut])
def list_messages(code: str, after_id: int = 0, db: Session = Depends(get_db)):
    """Chat history. Pass after_id to fetch only messages newer than the last one you have."""
    meeting = get_meeting_or_404(db, code)
    messages = (
        db.query(Message)
        .filter(Message.meeting_id == meeting.id, Message.id > after_id)
        .order_by(Message.id)
        .all()
    )
    return [
        MessageOut(
            id=m.id, participant_id=m.participant_id, sender_name=m.sender.display_name,
            content=m.content, created_at=m.created_at,
        )
        for m in messages
    ]


@router.post("/{code}/messages", response_model=MessageOut, status_code=201)
def send_message(code: str, payload: MessageCreate, db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(db, code)
    sender = get_participant_or_404(meeting, payload.participant_id)
    if sender.left_at is not None or sender.is_removed:
        raise HTTPException(status_code=403, detail="You are no longer in this meeting.")
    message = Message(meeting_id=meeting.id, participant_id=sender.id, content=payload.content)
    db.add(message)
    db.commit()
    db.refresh(message)
    return MessageOut(
        id=message.id, participant_id=sender.id, sender_name=sender.display_name,
        content=message.content, created_at=message.created_at,
    )


# ---------------------------------------------------------------- host controls
# Every host action takes the acting participant's id and checks it is the host.

def require_host(meeting: Meeting, acting_participant_id: int) -> Participant:
    actor = get_participant_or_404(meeting, acting_participant_id)
    if actor.role != "host":
        raise HTTPException(status_code=403, detail="Only the host can do this.")
    return actor


@router.post("/{code}/mute-all")
def mute_all(code: str, host_participant_id: int, db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(db, code)
    require_host(meeting, host_participant_id)
    muted = 0
    for p in active_participants(meeting):
        if p.role != "host" and not p.is_muted:
            p.is_muted = True
            muted += 1
    db.commit()
    return {"muted": muted}


@router.delete("/{code}/participants/{participant_id}")
def remove_participant(code: str, participant_id: int, host_participant_id: int, db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(db, code)
    require_host(meeting, host_participant_id)
    participant = get_participant_or_404(meeting, participant_id)
    if participant.role == "host":
        raise HTTPException(status_code=400, detail="The host cannot be removed.")
    participant.is_removed = True
    participant.left_at = participant.left_at or utcnow()
    db.commit()
    return {"removed": participant.id}


@router.post("/{code}/end")
def end_meeting(code: str, host_participant_id: int, db: Session = Depends(get_db)):
    """'End meeting for all' — host only."""
    meeting = get_meeting_or_404(db, code)
    require_host(meeting, host_participant_id)
    end_meeting_now(meeting)
    db.commit()
    return {"status": "ended"}
