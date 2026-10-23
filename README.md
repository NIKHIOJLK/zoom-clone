# Zoom Clone: video conferencing platform

A web clone of Zoom's meeting workflows. You can start an instant meeting, join by meeting ID or invite link, schedule meetings, chat in a meeting, and use host controls. The UI follows Zoom's Home screen, Join and Schedule dialogs, and the dark meeting room.

**Live app:** https://zoom-clone-sandy-five.vercel.app  
**API docs:** https://ryukishin12.pythonanywhere.com/docs

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
- **Video calls (WebRTC):** participants see and hear each other. Browsers connect peer to peer; the server only relays the signaling messages. Screen sharing is sent to everyone in place of your camera.
- **Real-time updates (WebSockets):** joins, leaves, chat, mute and remove reach everyone instantly. Closing the tab counts as leaving after a 10-second grace period (a page refresh doesn't kick you out).
- **Host controls:** Mute all, remove a participant, and End meeting for all.
- **In-meeting chat:** messages are stored in the DB, with an unread badge.
- Camera and mic preview, reactions, meeting info popover (ID, passcode, copy link) and a meeting timer.

## Accounts and security

- **Sign up / log in** with email and password. Passwords are hashed with **bcrypt**; login returns a **JWT** (7 days) that the frontend sends as `Authorization: Bearer …`.
- **Who you are comes from tokens, never from the request body.** The server decides whether you're the host by checking your login token against the meeting's host.
- **Participant tokens:** joining returns a signed token for that one meeting (guests too). Chat, mute, leave, the WebSocket and host controls all require it, so nobody can act as another participant by guessing an id.
- Wrong email and wrong password give the same error, so emails can't be probed.

## How real-time and video work

```
Browser A  ── WebSocket ──►  FastAPI  ◄── WebSocket ──  Browser B
   │   events: participants, message, removed, ended          │
   │   signal: SDP offer/answer + ICE candidates (relayed)    │
   └──────────────── WebRTC audio/video (peer to peer) ───────┘
```

1. After joining, each browser opens `ws://…/ws/meetings/{code}?participant_id=…` (`backend/app/realtime.py`, `frontend/hooks/useMeetingSocket.ts`).
2. REST endpoints still do the work (join, chat, mute…), and after each change the server **pushes** an event to everyone in the room instead of clients polling.
3. For video, every participant opens an `RTCPeerConnection` to every other online participant (`frontend/hooks/usePeers.ts`). Offers, answers and ICE candidates travel over the socket, using the "perfect negotiation" pattern so simultaneous offers don't collide.
4. STUN (Google's public servers) finds each browser's public address. On strict networks set a TURN relay with `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL`.
5. If the socket drops, the client reconnects with backoff and polls every 5 s until it's back.
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
| POST | `/api/auth/signup` | Create an account, returns a JWT |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET | `/api/users/me` | The logged-in user (needs `Authorization: Bearer <token>`) |
| POST | `/api/meetings/instant` | Create an instant meeting |
| POST | `/api/meetings/schedule` | Schedule a meeting |
| GET | `/api/meetings/upcoming` | Upcoming scheduled meetings |
| GET | `/api/meetings/recent` | Ended meetings hosted or attended |
| GET / DELETE | `/api/meetings/{code}` | Validate and look up, or delete a meeting |
| POST | `/api/meetings/{code}/join` | Join with a display name; returns a participant token |
| GET | `/api/meetings/{code}/participants` | People currently in the meeting |
| PATCH | `/api/meetings/{code}/participants/{id}` | Update own mute or video state |
| POST | `/api/meetings/{code}/participants/{id}/leave` | Leave the meeting |
| GET / POST | `/api/meetings/{code}/messages` | Chat |
| POST | `/api/meetings/{code}/mute-all` | Host: mute everyone |
| DELETE | `/api/meetings/{code}/participants/{id}` | Host: remove a participant |
| POST | `/api/meetings/{code}/end` | Host: end the meeting for all |
| WS | `/ws/meetings/{code}?participant_id=&token=` | Live events + WebRTC signaling |

Meeting actions (mute, leave, chat, host controls) send the participant token as `X-Participant-Token`.

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
| Backend | `JWT_SECRET` | A long random string that signs tokens. **Set this in production** (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) |
| Frontend | `NEXT_PUBLIC_API_URL` | `https://your-api.example.com` (the WebSocket URL is derived from it) |
| Frontend | `NEXT_PUBLIC_TURN_URL` / `_USERNAME` / `_CREDENTIAL` | Optional TURN relay for video across strict networks |

## Deployment

- **Frontend: Vercel.** Root directory `frontend`, env `NEXT_PUBLIC_API_URL=https://ryukishin12.pythonanywhere.com`. It redeploys on every push to `main`.
- **Backend: PythonAnywhere** (ASGI/uvicorn). Clone the repo, create a virtualenv, `pip install -r backend/requirements.txt`, then:
  `pa website create --domain <user>.pythonanywhere.com --command "<venv>/bin/uvicorn --app-dir ~/zoom-clone/backend --uds \${DOMAIN_SOCKET} app.main:app"`
  Settings go in `backend/.env` (`FRONTEND_URL=...`). To update: `git pull`, then `pa website reload --domain <user>.pythonanywhere.com`.


## Assumptions and limitations

- **Demo account:** seeded users can sign in with password `demo1234` (the login page has a one-click "Use demo account" button). Guests joining by link don't need an account.
- **Video is a mesh:** each browser sends its stream to every other participant, which suits small meetings (about 2–4 people). Larger rooms would use an SFU such as LiveKit or mediasoup.
- **One server process:** open sockets live in memory, so running several backend instances would need Redis pub/sub to share events between them.
- The UI recreates Zoom's layout, colours (Zoom blue `#0B5CFF`, orange `#FF742E`) and font (Lato), but uses a generic camera icon instead of Zoom's logo.
