from datetime import datetime, timedelta, timezone

from conftest import join, seat


def test_instant_meeting_has_id_passcode_and_link(meeting):
    assert meeting["meeting_code"].isdigit() and len(meeting["meeting_code"]) == 10
    assert meeting["status"] == "live"
    assert meeting["invite_link"].endswith(f"/join/{meeting['meeting_code']}?pwd={meeting['passcode']}")


def test_schedule_rejects_past_and_shows_in_upcoming(client, host_headers):
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    body = {"title": "Retro", "description": "", "duration_minutes": 30}
    assert client.post("/api/meetings/schedule", json={**body, "scheduled_start": past}, headers=host_headers).status_code == 422

    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    created = client.post("/api/meetings/schedule", json={**body, "scheduled_start": future}, headers=host_headers).json()
    upcoming = client.get("/api/meetings/upcoming", headers=host_headers).json()
    assert created["meeting_code"] in [m["meeting_code"] for m in upcoming]


def test_host_joins_without_passcode(client, host_headers, meeting):
    host = join(client, meeting["meeting_code"], "Nikhil", headers=host_headers).json()
    assert host["role"] == "host"
    assert host["participant_token"]


def test_guest_needs_the_right_passcode(client, meeting):
    code = meeting["meeting_code"]
    assert join(client, code, "Riya").status_code == 403
    assert join(client, code, "Riya", "wrong").status_code == 403
    guest = join(client, code, "Riya", meeting["passcode"])
    assert guest.status_code == 201
    assert guest.json()["role"] == "participant"


def test_guest_cannot_claim_to_be_the_host(client, meeting):
    res = client.post(
        f"/api/meetings/{meeting['meeting_code']}/join",
        json={"display_name": "Mallory", "passcode": meeting["passcode"], "user_id": meeting["host_id"]},
    )
    assert res.json()["role"] == "participant"  # identity comes from the token, not the body


def test_passcode_hidden_from_outsiders(client, host_headers, meeting):
    code = meeting["meeting_code"]
    outsider = client.get(f"/api/meetings/{code}").json()
    assert outsider["passcode"] == "" and "pwd=" not in outsider["invite_link"]
    assert client.get(f"/api/meetings/{code}", headers=host_headers).json()["passcode"] == meeting["passcode"]
    guest = join(client, code, "Riya", meeting["passcode"]).json()
    assert client.get(f"/api/meetings/{code}", headers=seat(guest)).json()["passcode"] == meeting["passcode"]


def test_only_the_host_can_use_host_controls(client, host_headers, meeting):
    code = meeting["meeting_code"]
    host = join(client, code, "Nikhil", headers=host_headers).json()
    guest = join(client, code, "Riya", meeting["passcode"]).json()

    assert client.post(f"/api/meetings/{code}/mute-all", headers=seat(guest)).status_code == 403
    assert client.post(f"/api/meetings/{code}/participants/{host['id']}/mute", headers=seat(guest)).status_code == 403
    assert client.post(f"/api/meetings/{code}/end", headers=seat(guest)).status_code == 403
    assert client.post(f"/api/meetings/{code}/mute-all").status_code == 401  # no token at all

    assert client.post(f"/api/meetings/{code}/participants/{guest['id']}/mute", headers=seat(host)).status_code == 200
    me = client.get(f"/api/meetings/{code}/participants/{guest['id']}").json()
    assert me["is_muted"] is True


def test_cannot_act_as_someone_else(client, host_headers, meeting):
    code = meeting["meeting_code"]
    host = join(client, code, "Nikhil", headers=host_headers).json()
    guest = join(client, code, "Riya", meeting["passcode"]).json()
    url = f"/api/meetings/{code}/participants/{host['id']}"
    assert client.patch(url, json={"is_muted": True}, headers=seat(guest)).status_code == 403
    assert client.post(f"{url}/leave", headers=seat(guest)).status_code == 403
    assert client.patch(url, json={"is_muted": True}, headers={"X-Participant-Token": "forged"}).status_code == 401


def test_participant_token_only_works_in_its_own_meeting(client, host_headers, meeting):
    other = client.post("/api/meetings/instant", json={}, headers=host_headers).json()
    guest = join(client, meeting["meeting_code"], "Riya", meeting["passcode"]).json()
    res = client.post(f"/api/meetings/{other['meeting_code']}/messages", json={"content": "hi"}, headers=seat(guest))
    assert res.status_code == 401


def test_chat_sender_comes_from_the_token(client, meeting):
    code = meeting["meeting_code"]
    guest = join(client, code, "Riya", meeting["passcode"]).json()
    sent = client.post(f"/api/meetings/{code}/messages", json={"content": "hello"}, headers=seat(guest)).json()
    assert sent["sender_name"] == "Riya"
    assert client.post(f"/api/meetings/{code}/messages", json={"content": "   "}, headers=seat(guest)).status_code == 422


def test_last_person_leaving_ends_the_meeting(client, host_headers, meeting):
    code = meeting["meeting_code"]
    host = join(client, code, "Nikhil", headers=host_headers).json()
    res = client.post(f"/api/meetings/{code}/participants/{host['id']}/leave", headers=seat(host))
    assert res.json()["status"] == "ended"
    recent = client.get("/api/meetings/recent", headers=host_headers).json()
    assert code in [m["meeting_code"] for m in recent]
    assert join(client, code, "Late", meeting["passcode"]).status_code == 410


def test_unknown_meeting_is_404(client):
    assert client.get("/api/meetings/1234567890").status_code == 404
