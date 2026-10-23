// Typed wrapper around the FastAPI backend. Every network call in the app goes through here.

import { clearToken, getToken, goToLogin } from "./auth";
import { loadSession } from "./session";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
/** Same server, WebSocket scheme: http -> ws, https -> wss. */
export const WS_URL = API_URL.replace(/^http/, "ws");

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

export type JoinResult = Participant & { participant_token: string };
export type AuthResult = { access_token: string; token_type: string; user: User };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Options = {
  asAccount?: boolean; // send the login token (default true)
  meeting?: string; // send my participant token for this meeting
  redirectOn401?: boolean; // expired login -> go to the login page (default true)
};

async function request<T>(path: string, init: RequestInit = {}, opts: Options = {}): Promise<T> {
  const { asAccount = true, meeting, redirectOn401 = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = asAccount ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  const participantToken = meeting ? loadSession(meeting)?.participantToken : undefined;
  if (participantToken) headers["X-Participant-Token"] = participantToken;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
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
    // the login is missing or expired: sign in again (not for meeting actions or the login form itself)
    if (res.status === 401 && !meeting && !path.startsWith("/api/auth") && redirectOn401) {
      clearToken();
      goToLogin();
    }
    throw new ApiError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const post = <T>(path: string, body?: unknown, opts?: Options) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, opts);

export const api = {
  login: (email: string, password: string) => post<AuthResult>("/api/auth/login", { email, password }, { asAccount: false }),
  signup: (name: string, email: string, password: string) =>
    post<AuthResult>("/api/auth/signup", { name, email, password }, { asAccount: false }),
  me: () => request<User>("/api/users/me", {}, { redirectOn401: false }),

  upcoming: () => request<Meeting[]>("/api/meetings/upcoming"),
  recent: () => request<Meeting[]>("/api/meetings/recent"),
  getMeeting: (code: string) => request<Meeting>(`/api/meetings/${encodeURIComponent(code)}`),
  deleteMeeting: (code: string) => request<void>(`/api/meetings/${code}`, { method: "DELETE" }),

  createInstant: () => post<Meeting>("/api/meetings/instant", {}),
  schedule: (data: { title: string; description: string; scheduled_start: string; duration_minutes: number }) =>
    post<Meeting>("/api/meetings/schedule", data),

  // asAccount: join as my account (host of my own meetings) instead of as a guest
  join: (code: string, display_name: string, asAccount: boolean) =>
    post<JoinResult>(`/api/meetings/${code}/join`, { display_name }, { asAccount, redirectOn401: false }),
  leave: (code: string, participantId: number) =>
    post<{ status: string }>(`/api/meetings/${code}/participants/${participantId}/leave`, undefined, { meeting: code }),
  participants: (code: string) => request<Participant[]>(`/api/meetings/${code}/participants`),
  participant: (code: string, id: number) => request<Participant>(`/api/meetings/${code}/participants/${id}`),
  updateSelf: (code: string, id: number, data: { is_muted?: boolean; is_video_on?: boolean }) =>
    request<Participant>(`/api/meetings/${code}/participants/${id}`, { method: "PATCH", body: JSON.stringify(data) }, { meeting: code }),

  messages: (code: string, afterId = 0) => request<ChatMessage[]>(`/api/meetings/${code}/messages?after_id=${afterId}`),
  // the sender is taken from my participant token
  sendMessage: (code: string, content: string) => post<ChatMessage>(`/api/meetings/${code}/messages`, { content }, { meeting: code }),

  // host controls: the backend checks my participant token belongs to the host
  muteAll: (code: string) => post<{ muted: number }>(`/api/meetings/${code}/mute-all`, undefined, { meeting: code }),
  remove: (code: string, participantId: number) =>
    request<{ removed: number }>(`/api/meetings/${code}/participants/${participantId}`, { method: "DELETE" }, { meeting: code }),
  endForAll: (code: string) => post<{ status: string }>(`/api/meetings/${code}/end`, undefined, { meeting: code }),
};
