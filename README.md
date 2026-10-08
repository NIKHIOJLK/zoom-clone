# Zoom Clone: video conferencing platform

A web clone of Zoom's meeting workflows. You can start an instant meeting, join by meeting ID or invite link, schedule meetings, chat in a meeting, and use host controls. The UI follows Zoom's Home screen, Join and Schedule dialogs, and the dark meeting room.

**Live app:** _add your Vercel URL here_  
**API docs:** _add your Render URL here_/docs

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind CSS v4, lucide-react icons, date-fns |
| Backend | Python, FastAPI, SQLAlchemy 2, Pydantic v2 |
| Database | SQLite |
| Hosting | Vercel (frontend), Render (backend) |

## Features

**Core**
- **Home dashboard:** navbar with profile, settings and notification placeholders. It has the four Zoom tiles (New meeting, Join, Schedule, Share screen), a live clock card, **Upcoming meetings** grouped by day, and **Recent meetings**.
- **Instant meeting:** creates a unique 10-digit meeting ID, a passcode and a shareable invite link (`/join/<id>`), then takes you straight into the room as host.
- **Join meeting:** accepts a meeting ID (`847 291 6305`, `847-291-6305` or `8472916305`) or a full invite link, plus your display name. The meeting is validated before you join, and you get a clear error if the ID is invalid or the meeting has ended.
- **Schedule meeting:** topic, description, date, time (15-minute steps, local time zone) and duration. The meeting is saved to the database with an auto-generated link and shows up in Upcoming immediately. You can copy the invitation or delete it.

**Bonus**
- **Host controls:** Mute all, remove a participant, and End meeting for all. Participants who are muted or removed by the host see it within a few seconds.
- **In-meeting chat:** messages are stored in the DB, with an unread badge.
- Camera and mic preview, screen sharing (`getDisplayMedia`), reactions, meeting info popover (ID, passcode, copy link) and a meeting timer.
- **Meetings tab:** an Upcoming/Previous list with a details pane, like Zoom's.
- **Responsive:** works on mobile, tablet and desktop. The toolbar collapses to icons, and side panels go full-screen on phones.

## Database schema

```
users ─────────< meetings ─────────< participants >───────── users (optional)
                    │                     │
                    └────────< messages >─┘
```

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, name, email (unique) | Seeded; user 1 is the default logged-in user |
| `meetings` | id, **meeting_code** (unique, indexed), title, description, host_id → users, type (`instant`/`scheduled`), status (`scheduled`/`live`/`ended`), scheduled_start (indexed), duration_minutes, passcode, created_at, started_at, ended_at | CHECK constraints on type, status and duration |
| `participants` | id, meeting_id → meetings, user_id → users (nullable), display_name, role (`host`/`participant`), is_muted, is_video_on, is_removed, joined_at, left_at | One row per join, so guests without accounts can join |
| `messages` | id, meeting_id → meetings, participant_id → participants, content, created_at | In-meeting chat |

**Design decisions**
- **`meeting_code` is separate from the primary key.** It's the public, shareable ID. It's random, so meetings can't be guessed by counting, and the integer `id` stays internal.
- **Participants are separate from users.** Anyone with the invite link can join with just a name (`user_id` is NULL), as in Zoom.
- **The meeting lifecycle is a status field.** Meetings go `scheduled` → `live` (first join) → `ended` (host ends it, or the last person leaves). Upcoming and Recent are just queries on this field.
- **All timestamps are stored in UTC.** The API returns ISO strings ending in `Z`, and the browser shows them in local time.
- Foreign keys are enforced (`PRAGMA foreign_keys=ON`), and deleting a meeting cascades to its participants and messages.

## API

Interactive docs are at `/docs` (Swagger).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/users/me` | The default logged-in user |
| POST | `/api/meetings/instant` | Create an instant meeting |
| POST | `/api/meetings/schedule` | Schedule a meeting |
| GET | `/api/meetings/upcoming` | Upcoming scheduled meetings |
| GET | `/api/meetings/recent` | Ended meetings hosted or attended |
| GET / DELETE | `/api/meetings/{code}` | Validate and look up, or delete a meeting |
| POST | `/api/meetings/{code}/join` | Join with a display name |
| GET | `/api/meetings/{code}/participants` | People currently in the meeting |
| PATCH | `/api/meetings/{code}/participants/{id}` | Update own mute or video state |
| POST | `/api/meetings/{code}/participants/{id}/leave` | Leave the meeting |
| GET / POST | `/api/meetings/{code}/messages` | Chat |
| POST | `/api/meetings/{code}/mute-all?host_participant_id=` | Host: mute everyone |
| DELETE | `/api/meetings/{code}/participants/{id}?host_participant_id=` | Host: remove a participant |
| POST | `/api/meetings/{code}/end?host_participant_id=` | Host: end the meeting for all |

## Project structure

```
backend/app/
  main.py          app setup, CORS, startup (create tables + seed)
  config.py        env settings
  database.py      engine, session, get_db dependency
  models.py        SQLAlchemy models (schema)
  schemas.py       Pydantic request/response models
  deps.py          get_current_user (default user)
  seed.py          sample data
  routers/         users.py, meetings.py
frontend/
  app/             routes: / , /meetings , /join , /join/[code] , /meeting/[code]
  components/      TopNav, modals, home/*, meeting/* (room, toolbar, panels, tiles)
  hooks/           useCurrentUser, useStartMeeting, useLocalMedia, useBrowserValue
  lib/             api.ts (typed API client), format.ts, session.ts
```

## Run locally

Prerequisites: Python 3.11+ and Node 20+.

**Backend** (terminal 1)
```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000/docs
```
The SQLite file `zoom.db` is created and seeded on first start. Delete it to reset the data.

**Frontend** (terminal 2)
```bash
cd frontend
npm install
npm run dev                      # http://localhost:3000
```
The frontend calls `http://localhost:8000` by default. To change it, set `NEXT_PUBLIC_API_URL` in `frontend/.env.local`.

**To try host controls:** start a meeting, copy the invite link from the green shield icon or Participants → Invite, and open it in an incognito window as a guest.

## Environment variables

| Where | Variable | Example |
|---|---|---|
| Backend | `FRONTEND_URL` | `https://your-app.vercel.app` (used to build invite links) |
| Backend | `CORS_ORIGINS` | `https://your-app.vercel.app` (comma-separated; defaults to `FRONTEND_URL`) |
| Backend | `DATABASE_URL` | `sqlite:///./zoom.db` (default) |
| Frontend | `NEXT_PUBLIC_API_URL` | `https://your-api.onrender.com` |

## Deployment

1. **Backend on Render:** New → Web Service → this repo.
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Env: `FRONTEND_URL` = your Vercel URL (you can add it after step 2)
2. **Frontend on Vercel:** Import the repo with root directory `frontend`, and set env `NEXT_PUBLIC_API_URL` = your Render URL.
3. Put the Vercel URL into Render's `FRONTEND_URL`, then redeploy the backend.

## Assumptions and limitations

- **No login** (per the brief). The first seeded user, Nikhil Sharma, is always "logged in" through one dependency (`get_current_user`), so real auth would only change that file.
- **Host actions** are authorized by checking that the acting participant has the `host` role in that meeting. Without real auth this is trust-based, which is fine for a demo.
- **Video and audio are local only.** Each person sees their own camera, and others appear as avatar tiles with their live mute and video status. Streaming media between browsers would need WebRTC plus a signalling server (or an SFU), which is outside the scope of this assignment.
- **Real-time updates use polling** (every 2.5 seconds) rather than WebSockets. That's simple and reliable on free hosting.
- **SQLite on Render's free tier** is reset when the service restarts. The app re-seeds itself on startup, so demo data is always there. For production, use a persistent disk or Postgres (only `DATABASE_URL` changes).
- Closing the tab without clicking Leave leaves that participant listed until the host removes them or ends the meeting.
- The UI recreates Zoom's layout, colours (Zoom blue `#0B5CFF`, orange `#FF742E`) and font (Lato), but uses a generic camera icon instead of Zoom's logo.
