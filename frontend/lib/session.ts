// Remembers "who I am in this meeting" (my participant id) for the browser tab.
// sessionStorage is per-tab, so two tabs can join the same meeting as two different people,
// which is handy for testing host controls.

export type MeetingSession = {
  participantId: number;
  displayName: string;
  role: "host" | "participant";
  startMuted: boolean;
  startVideoOff: boolean;
};

const key = (code: string) => `zoomclone:meeting:${code}`;
const NAME_KEY = "zoomclone:displayName";

export function saveSession(code: string, s: MeetingSession) {
  try {
    sessionStorage.setItem(key(code), JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode) — the room will send the user back to the join screen */
  }
}

export function loadSession(code: string): MeetingSession | null {
  try {
    const raw = sessionStorage.getItem(key(code));
    return raw ? (JSON.parse(raw) as MeetingSession) : null;
  } catch {
    return null;
  }
}

export function clearSession(code: string) {
  try {
    sessionStorage.removeItem(key(code));
  } catch {
    /* ignore */
  }
}

/** "Remember my name for future meetings" */
export function rememberedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}
