// Typed wrapper around the FastAPI backend. Every network call in the app goes through here.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type User = { id: number; name: string; email: string };

export type Meeting = {
  id: number;
  meeting_code: string;
  title: string;
  description: string;
  type: "instant" | "scheduled";
  status: "scheduled" | "live" | "ended";
  scheduled_start: string | null;
  duration_minutes: number;
  passcode: string;
  host_id: number;
  host_name: string;
  invite_link: string;
  participant_count: number;
  total_participants: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type Participant = {
  id: number;
  display_name: string;
  role: "host" | "participant";
  is_muted: boolean;
  is_video_on: boolean;
  is_removed: boolean;
  joined_at: string;
  left_at: string | null;
};

export type ChatMessage = {
  id: number;
  participant_id: number;
  sender_name: string;
  content: string;
  created_at: string;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      // FastAPI returns {detail: "..."} or {detail: [{msg: "..."}]} for validation errors
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail) && body.detail[0]?.msg)
        message = String(body.detail[0].msg).replace(/^Value error, /, "");
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  me: () => request<User>("/api/users/me"),

  upcoming: () => request<Meeting[]>("/api/meetings/upcoming"),
  recent: () => request<Meeting[]>("/api/meetings/recent"),
  getMeeting: (code: string) => request<Meeting>(`/api/meetings/${encodeURIComponent(code)}`),
  deleteMeeting: (code: string) => request<void>(`/api/meetings/${code}`, { method: "DELETE" }),

  createInstant: () => post<Meeting>("/api/meetings/instant", {}),
  schedule: (data: { title: string; description: string; scheduled_start: string; duration_minutes: number }) =>
    post<Meeting>("/api/meetings/schedule", data),

  join: (code: string, display_name: string, user_id?: number) =>
    post<Participant>(`/api/meetings/${code}/join`, { display_name, user_id }),
  leave: (code: string, participantId: number) =>
    post<{ status: string }>(`/api/meetings/${code}/participants/${participantId}/leave`),
  participants: (code: string) => request<Participant[]>(`/api/meetings/${code}/participants`),
  participant: (code: string, id: number) => request<Participant>(`/api/meetings/${code}/participants/${id}`),
  updateSelf: (code: string, id: number, data: { is_muted?: boolean; is_video_on?: boolean }) =>
    request<Participant>(`/api/meetings/${code}/participants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  messages: (code: string, afterId = 0) => request<ChatMessage[]>(`/api/meetings/${code}/messages?after_id=${afterId}`),
  sendMessage: (code: string, participant_id: number, content: string) =>
    post<ChatMessage>(`/api/meetings/${code}/messages`, { participant_id, content }),

  // host controls: the backend checks hostId belongs to the host
  muteAll: (code: string, hostId: number) => post<{ muted: number }>(`/api/meetings/${code}/mute-all?host_participant_id=${hostId}`),
  remove: (code: string, participantId: number, hostId: number) =>
    request<{ removed: number }>(`/api/meetings/${code}/participants/${participantId}?host_participant_id=${hostId}`, {
      method: "DELETE",
    }),
  endForAll: (code: string, hostId: number) => post<{ status: string }>(`/api/meetings/${code}/end?host_participant_id=${hostId}`),
};
