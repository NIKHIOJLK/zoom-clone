"""Sample data, inserted once on first startup (when the users table is empty)."""
from datetime import timedelta

from sqlalchemy.orm import Session

from .models import Meeting, Participant, User, utcnow


def seed(db: Session) -> None:
    if db.query(User).first():
        return  # already seeded

    users = [
        User(name="Nikhil Sharma", email="nikhil.sharma@example.com"),  # default logged-in user (id=1)
        User(name="Riya Kapoor", email="riya.kapoor@example.com"),
        User(name="Aman Verma", email="aman.verma@example.com"),
        User(name="Sneha Iyer", email="sneha.iyer@example.com"),
        User(name="Karan Malhotra", email="karan.malhotra@example.com"),
    ]
    db.add_all(users)
    db.flush()  # assigns ids
    me, others = users[0], users[1:]
    now = utcnow().replace(second=0, microsecond=0)
    # round to the next half hour so seeded times look natural (10:30, 11:00 …)
    base = now.replace(minute=0) + timedelta(minutes=30 if now.minute < 30 else 60)

    upcoming = [
        ("8472916305", "Daily Standup", "Quick sync on blockers and progress.", timedelta(hours=1), 15),
        ("5120938476", "Sprint Planning", "Plan the next sprint and assign tasks.", timedelta(days=1, hours=2), 60),
        ("6639201847", "Client Demo Review", "Walkthrough of the latest build with the client.", timedelta(days=2, hours=5), 45),
        ("7301846259", "Design Sync", "Review the new dashboard designs.", timedelta(days=4), 30),
    ]
    for code, title, desc, delta, duration in upcoming:
        db.add(Meeting(
            meeting_code=code, title=title, description=desc, host_id=me.id,
            type="scheduled", status="scheduled", scheduled_start=base + delta,
            duration_minutes=duration, passcode="Zm" + code[-4:], created_at=now - timedelta(days=1),
        ))

    past = [
        ("9182736450", "Weekly Team Sync", "scheduled", timedelta(days=1, hours=3), 45),
        ("3847562019", "Project Kickoff", "scheduled", timedelta(days=3), 60),
        ("2910384756", "Nikhil Sharma's Zoom Meeting", "instant", timedelta(days=5, hours=6), 25),
        ("4471029385", "Interview Prep Session", "scheduled", timedelta(days=8), 30),
    ]
    for i, (code, title, mtype, ago, duration) in enumerate(past):
        start = base - ago
        end = start + timedelta(minutes=duration)
        meeting = Meeting(
            meeting_code=code, title=title, description="", host_id=me.id,
            type=mtype, status="ended",
            scheduled_start=start if mtype == "scheduled" else None,
            duration_minutes=duration, passcode="Zm" + code[-4:],
            created_at=start - timedelta(days=1), started_at=start, ended_at=end,
        )
        db.add(meeting)
        db.flush()
        db.add(Participant(
            meeting_id=meeting.id, user_id=me.id, display_name=me.name,
            role="host", joined_at=start, left_at=end,
        ))
        for guest in others[: 1 + (i % 4)]:
            db.add(Participant(
                meeting_id=meeting.id, user_id=guest.id, display_name=guest.name,
                role="participant", joined_at=start + timedelta(minutes=1), left_at=end,
            ))

    db.commit()
