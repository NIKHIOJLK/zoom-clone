import pytest
from starlette.websockets import WebSocketDisconnect

from conftest import join, seat


def socket_url(meeting, participant):
    return f"/ws/meetings/{meeting['meeting_code']}?participant_id={participant['id']}&token={participant['participant_token']}"


def next_event(ws, kind):
    """Read events until one of the given type arrives."""
    for _ in range(20):
        event = ws.receive_json()
        if event["type"] == kind:
            return event
    raise AssertionError(f"no {kind} event")


def test_socket_pushes_participants_and_chat(client, host_headers, meeting):
    host = join(client, meeting["meeting_code"], "Nikhil", headers=host_headers).json()
    guest = join(client, meeting["meeting_code"], "Riya", meeting["passcode"]).json()
    with client.websocket_connect(socket_url(meeting, host)) as ws:
        first = next_event(ws, "participants")
        assert {p["display_name"] for p in first["participants"]} == {"Nikhil", "Riya"}
        assert host["id"] in first["online"]

        client.post(f"/api/meetings/{meeting['meeting_code']}/messages", json={"content": "hi"}, headers=seat(guest))
        assert next_event(ws, "message")["message"]["content"] == "hi"


def test_socket_relays_webrtc_signals(client, host_headers, meeting):
    host = join(client, meeting["meeting_code"], "Nikhil", headers=host_headers).json()
    guest = join(client, meeting["meeting_code"], "Riya", meeting["passcode"]).json()
    with client.websocket_connect(socket_url(meeting, host)) as h, client.websocket_connect(socket_url(meeting, guest)) as g:
        h.send_json({"type": "signal", "to": guest["id"], "data": {"description": {"type": "offer", "sdp": "x"}}})
        relayed = next_event(g, "signal")
        assert relayed["from"] == host["id"]
        assert relayed["data"]["description"]["type"] == "offer"


def test_socket_rejects_someone_elses_token(client, host_headers, meeting):
    host = join(client, meeting["meeting_code"], "Nikhil", headers=host_headers).json()
    guest = join(client, meeting["meeting_code"], "Riya", meeting["passcode"]).json()
    url = f"/ws/meetings/{meeting['meeting_code']}?participant_id={host['id']}&token={guest['participant_token']}"
    with pytest.raises(WebSocketDisconnect) as closed:
        with client.websocket_connect(url) as ws:
            ws.receive_json()
    assert closed.value.code == 4401


def test_removed_participant_is_told_and_cannot_reconnect(client, host_headers, meeting):
    code = meeting["meeting_code"]
    host = join(client, code, "Nikhil", headers=host_headers).json()
    guest = join(client, code, "Riya", meeting["passcode"]).json()
    with client.websocket_connect(socket_url(meeting, guest)) as ws:
        client.delete(f"/api/meetings/{code}/participants/{guest['id']}", headers=seat(host))
        assert next_event(ws, "removed") == {"type": "removed"}
    with pytest.raises(WebSocketDisconnect) as closed:
        with client.websocket_connect(socket_url(meeting, guest)) as ws:
            ws.receive_json()
    assert closed.value.code == 4404
