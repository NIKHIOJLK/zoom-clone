"""Pydantic models: what the API accepts (…Create / …Request) and returns (…Out)."""
from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, Field, PlainSerializer, field_validator

# The DB stores naive UTC. Adding "Z" tells the browser the value is UTC,
# so `new Date(value)` converts it to the viewer's local time correctly.
UTCDateTime = Annotated[datetime, PlainSerializer(lambda d: d.isoformat() + "Z", return_type=str)]


def _strip_required(v: str, label: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError(f"{label} is required")
    return v


class UserOut(BaseModel):
    id: int
    name: str
    email: str

    model_config = {"from_attributes": True}


class InstantMeetingCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)


class ScheduleMeetingCreate(BaseModel):
    title: str = Field(max_length=200)
    description: str = Field(default="", max_length=2000)
    scheduled_start: datetime  # ISO string from the browser, e.g. "2026-10-09T10:30:00.000Z"
    duration_minutes: int = Field(default=40, ge=5, le=1440)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        return _strip_required(v, "Topic")


class MeetingOut(BaseModel):
    id: int
    meeting_code: str
    title: str
    description: str
    type: str
    status: str
    scheduled_start: Optional[UTCDateTime] = None
    duration_minutes: int
    passcode: str
    host_id: int
    host_name: str
    invite_link: str
    participant_count: int  # currently in the meeting
    total_participants: int  # everyone who ever joined (shown for past meetings)
    created_at: UTCDateTime
    started_at: Optional[UTCDateTime] = None
    ended_at: Optional[UTCDateTime] = None


class JoinRequest(BaseModel):
    display_name: str = Field(max_length=60)
    user_id: Optional[int] = None  # set when the logged-in user joins (makes them host of own meeting)

    @field_validator("display_name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        return _strip_required(v, "Your name")


class ParticipantUpdate(BaseModel):
    is_muted: Optional[bool] = None
    is_video_on: Optional[bool] = None


class ParticipantOut(BaseModel):
    id: int
    display_name: str
    role: str
    is_muted: bool
    is_video_on: bool
    is_removed: bool
    joined_at: UTCDateTime
    left_at: Optional[UTCDateTime] = None

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    participant_id: int
    content: str = Field(max_length=1000)

    @field_validator("content")
    @classmethod
    def content_not_blank(cls, v: str) -> str:
        return _strip_required(v, "Message")


class MessageOut(BaseModel):
    id: int
    participant_id: int
    sender_name: str
    content: str
    created_at: UTCDateTime
