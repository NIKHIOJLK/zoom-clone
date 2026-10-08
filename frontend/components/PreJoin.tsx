"use client";

import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import SelfVideo from "./meeting/SelfVideo";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { api, ApiError, type Meeting } from "@/lib/api";
import { formatMeetingId, timeRange, dayLabel } from "@/lib/format";
import { rememberName, saveSession } from "@/lib/session";
import { useRememberedName } from "@/hooks/useBrowserValue";

/** Landing page for an invite link: preview your camera, enter your name, join. */
export default function PreJoin({ code }: { code: string }) {
  const router = useRouter();
  const user = useCurrentUser();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const savedName = useRememberedName();
  const [typedName, setName] = useState<string | null>(null);
  // until the user types, prefill with their remembered name or the account name
  const name = typedName ?? (savedName || user?.name || "");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const media = useLocalMedia({ videoOn: true, micOn: true });

  // validate the meeting before showing the join form
  useEffect(() => {
    api
      .getMeeting(code)
      .then(setMeeting)
      .catch((e) => setLookupError(e instanceof ApiError ? e.message : "Couldn't find this meeting."));
  }, [code]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !meeting) return;
    setBusy(true);
    setJoinError(null);
    try {
      // only pass the user id when joining under the account's own name,
      // so a second tab joining as "Guest" stays a normal participant
      const asAccount = user && name.trim() === user.name ? user.id : undefined;
      const p = await api.join(meeting.meeting_code, name.trim(), asAccount);
      if (remember) rememberName(name.trim());
      saveSession(meeting.meeting_code, {
        participantId: p.id,
        displayName: p.display_name,
        role: p.role,
        startMuted: !media.micOn,
        startVideoOff: !media.videoOn,
      });
      router.push(`/meeting/${meeting.meeting_code}`);
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : "Unable to join. Try again.");
      setBusy(false);
    }
  }

  if (lookupError || meeting?.status === "ended") {
    return (
      <CenteredMessage
        title={meeting?.status === "ended" ? "This meeting has ended" : "Invalid meeting ID"}
        body={meeting?.status === "ended" ? "The host has ended this meeting." : lookupError!}
      />
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-room-bg text-white">
      <header className="flex h-12 items-center justify-between px-5 text-sm text-room-muted">
        <Link href="/" className="font-bold text-white">
          Zoom Clone
        </Link>
        {meeting && <span>Meeting ID: {formatMeetingId(meeting.meeting_code)}</span>}
      </header>

      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center gap-6 px-4 pb-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{meeting ? meeting.title : " "}</h1>
          {meeting?.scheduled_start && (
            <p className="mt-1 text-sm text-room-muted">
              {dayLabel(meeting.scheduled_start)}, {timeRange(meeting.scheduled_start, meeting.duration_minutes)} · Host: {meeting.host_name}
            </p>
          )}
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-room-tile">
          {media.videoOn && media.videoStream ? (
            <SelfVideo stream={media.videoStream} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Avatar name={name || "?"} size={88} rounded="full" />
              {media.error && <p className="max-w-sm px-4 text-center text-sm text-room-muted">{media.error}</p>}
            </div>
          )}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-3">
            <RoundToggle on={media.micOn} onClick={() => media.setMicOn(!media.micOn)} onIcon={Mic} offIcon={MicOff} label="microphone" />
            <RoundToggle on={media.videoOn} onClick={() => media.setVideoOn(!media.videoOn)} onIcon={Video} offIcon={VideoOff} label="video" />
          </div>
        </div>

        <form onSubmit={join} className="flex w-full max-w-[420px] flex-col gap-3">
          <label className="text-sm text-room-muted" htmlFor="display-name">
            Your name
          </label>
          <input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Enter your name"
            className="rounded-lg border border-room-border bg-room-panel px-3 py-2.5 text-white outline-none focus:border-zoom-blue"
          />
          <label className="flex items-center gap-2 text-sm text-room-muted">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-zoom-blue" />
            Remember my name for future meetings
          </label>
          {joinError && (
            <p role="alert" className="text-sm text-[#ff6b6b]">
              {joinError}
            </p>
          )}
          <button
            disabled={!meeting || !name.trim() || busy}
            className="mt-1 rounded-lg bg-zoom-blue py-2.5 font-bold hover:bg-zoom-blue-hover disabled:opacity-40"
          >
            {busy ? "Joining…" : "Join"}
          </button>
        </form>
      </div>
    </main>
  );
}

function RoundToggle({
  on,
  onClick,
  onIcon: OnIcon,
  offIcon: OffIcon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  onIcon: typeof Mic;
  offIcon: typeof Mic;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={on ? `Turn off ${label}` : `Turn on ${label}`}
      className={`flex h-11 w-11 items-center justify-center rounded-full ${on ? "bg-black/50 hover:bg-black/70" : "bg-zoom-red hover:bg-zoom-red-hover"}`}
    >
      {on ? <OnIcon size={20} /> : <OffIcon size={20} />}
    </button>
  );
}

export function CenteredMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zoom-surface px-6 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="max-w-md text-zoom-muted">{body}</p>
      <Link href="/" className="mt-3 rounded-lg bg-zoom-blue px-5 py-2.5 font-bold text-white hover:bg-zoom-blue-hover">
        Back to home
      </Link>
    </main>
  );
}
