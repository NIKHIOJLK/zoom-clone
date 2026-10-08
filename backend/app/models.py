"""Database schema.

users 1 ──< meetings        (a user hosts many meetings)
meetings 1 ──< participants (a meeting has many participant sessions)
users 1 ──< participants    (optional: guests joining by link have no user row)
meetings 1 ──< messages     (in-meeting chat)
participants 1 ──< messages (who sent it)
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


def utcnow() -> datetime:
    """Naive UTC datetime. Every datetime in the DB is stored as UTC."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    hosted_meetings = relationship("Meeting", back_populates="host")


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (
        CheckConstraint("type IN ('instant', 'scheduled')", name="ck_meeting_type"),
        CheckConstraint("status IN ('scheduled', 'live', 'ended')", name="ck_meeting_status"),
        CheckConstraint("duration_minutes > 0", name="ck_meeting_duration"),
    )

    id = Column(Integer, primary_key=True, index=True)
    meeting_code = Column(String(11), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="", nullable=False)
    host_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(20), nullable=False)
    status = Column(String(20), default="scheduled", nullable=False)
    scheduled_start = Column(DateTime, nullable=True, index=True)  # NULL for instant meetings
    duration_minutes = Column(Integer, default=40, nullable=False)
    passcode = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)

    host = relationship("User", back_populates="hosted_meetings")
    participants = relationship(
        "Participant",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="Participant.joined_at",
    )
    messages = relationship(
        "Message",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Participant(Base):
    """One row per person per join. Leaving sets left_at; rejoining creates a new row."""

    __tablename__ = "participants"
    __table_args__ = (
        CheckConstraint("role IN ('host', 'participant')", name="ck_participant_role"),
    )

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    display_name = Column(String(60), nullable=False)
    role = Column(String(20), default="participant", nullable=False)
    is_muted = Column(Boolean, default=False, nullable=False)
    is_video_on = Column(Boolean, default=True, nullable=False)
    is_removed = Column(Boolean, default=False, nullable=False)
    joined_at = Column(DateTime, default=utcnow, nullable=False)
    left_at = Column(DateTime, nullable=True)

    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("User")


class Message(Base):
    """In-meeting chat message sent to everyone."""

    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id = Column(Integer, ForeignKey("participants.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    meeting = relationship("Meeting", back_populates="messages")
    sender = relationship("Participant")
