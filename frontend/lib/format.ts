import { format, isToday, isTomorrow } from "date-fns";

/** "8472916305" -> "847 291 6305" (how Zoom displays meeting IDs) */
export function formatMeetingId(code: string): string {
  const d = code.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  if (d.length === 11) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  return d;
}

/**
 * Pulls a meeting ID out of whatever the user pasted:
 * "847 291 6305", "8472916305", or an invite link like "https://site/join/8472916305".
 */
export function extractMeetingCode(input: string): string {
  const trimmed = input.trim();
  const fromLink = trimmed.match(/\/(?:join|meeting)\/(\d[\d\s-]*)/);
  return (fromLink ? fromLink[1] : trimmed).replace(/\D/g, "");
}

export const timeOf = (iso: string) => format(new Date(iso), "h:mm a");

/** "Today", "Tomorrow", or "Sat, Oct 10" */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE, MMM d");
}

export function timeRange(startIso: string, minutes: number): string {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + minutes * 60_000);
  return `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
}

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Stable avatar colour per name, from a small palette of Zoom-like tones. */
const AVATAR_COLORS = ["#0B5CFF", "#00A06B", "#E8590C", "#7B4DFF", "#D6336C", "#0C8599", "#B7791F"];
export function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** The text Zoom puts on the clipboard for "Copy invitation". */
export function invitationText(m: { host_name: string; title: string; invite_link: string; meeting_code: string; passcode: string; scheduled_start: string | null }) {
  const when = m.scheduled_start ? `\nTime: ${format(new Date(m.scheduled_start), "MMM d, yyyy h:mm a")}\n` : "\n";
  return (
    `${m.host_name} is inviting you to a scheduled meeting.\n\n` +
    `Topic: ${m.title}${when}\n` +
    `Join meeting\n${m.invite_link}\n\n` +
    `Meeting ID: ${formatMeetingId(m.meeting_code)}\nPasscode: ${m.passcode}`
  );
}
