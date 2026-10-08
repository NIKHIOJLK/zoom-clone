"use client";

import {
  ChevronUp,
  CircleDot,
  Ellipsis,
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Smile,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ChatPanel from "./ChatPanel";
import MeetingInfo from "./MeetingInfo";
import ParticipantsPanel from "./ParticipantsPanel";
import ToolbarButton from "./ToolbarButton";
import VideoTile from "./VideoTile";
import { CenteredMessage } from "../PreJoin";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { api, ApiError, type ChatMessage, type Meeting, type Participant } from "@/lib/api";
import { clearSession, loadSession, type MeetingSession } from "@/lib/session";

const POLL_MS = 2500;
const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉"];

type Phase = "loading" | "in" | "left" | "removed" | "ended";
type Panel = "participants" | "chat" | null;

function gridCols(n: number) {
  if (n <= 1) return "grid-cols-1";
  if (n <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (n <= 9) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
}

export default function MeetingRoom({ code }: { code: string }) {
  const router = useRouter();
  // read once in the browser; on the server there is no sessionStorage, and both render "Connecting…"
  const [session] = useState<MeetingSession | null>(() => (typeof window === "undefined" ? null : loadSession(code)));
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [seenMessages, setSeenMessages] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [panel, setPanel] = useState<Panel>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const media = useLocalMedia({
    videoOn: !(session?.startVideoOff ?? false),
    micOn: !(session?.startMuted ?? false),
  });
  const lastMessageId = useRef(0);
  const hostMutedRef = useRef(false);
  const isHost = session?.role === "host";
  const meId = session?.participantId ?? -1;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  // 1. Who am I? No session for this meeting in this tab -> go to the join screen.
  useEffect(() => {
    if (!session) router.replace(`/join/${code}`);
  }, [session, code, router]);

  // 2. Poll the server for participants, my own state, meeting status and new chat messages.
  const poll = useCallback(async () => {
    if (!session) return;
    try {
      const [m, people, me, newMsgs] = await Promise.all([
        api.getMeeting(code),
        api.participants(code),
        api.participant(code, session.participantId),
        api.messages(code, lastMessageId.current),
      ]);
      setMeeting(m);
      setParticipants(people);
      if (newMsgs.length) {
        lastMessageId.current = newMsgs[newMsgs.length - 1].id;
        setMessages((prev) => [...prev, ...newMsgs]);
      }
      if (me.is_removed) return setPhase("removed");
      if (m.status === "ended" || me.left_at) return setPhase((p) => (p === "left" ? p : "ended"));
      // the host muted me: turn my mic off locally
      if (me.is_muted && !hostMutedRef.current) {
        hostMutedRef.current = true;
        media.setMicOn((on) => {
          if (on) flash("The host muted you");
          return false;
        });
      }
      if (!me.is_muted) hostMutedRef.current = false;
      setPhase((p) => (p === "loading" ? "in" : p));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setPhase("ended");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, session, flash]);

  useEffect(() => {
    if (!session || phase === "left" || phase === "removed" || phase === "ended") return;
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [session, phase, poll]);

  // meeting timer
  useEffect(() => {
    if (phase !== "in") return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // stop screen share and camera when we're no longer in the meeting
  useEffect(() => {
    if (phase === "left" || phase === "removed" || phase === "ended") {
      screen?.getTracks().forEach((t) => t.stop());
      media.setVideoOn(false);
      media.setMicOn(false);
      clearSession(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ------------------------------------------------------------- actions

  async function toggleMic() {
    if (!session) return;
    const next = !media.micOn;
    media.setMicOn(next);
    hostMutedRef.current = !next;
    api.updateSelf(code, session.participantId, { is_muted: !next }).catch(() => {});
  }

  async function toggleVideo() {
    if (!session) return;
    const next = !media.videoOn;
    media.setVideoOn(next);
    api.updateSelf(code, session.participantId, { is_video_on: next }).catch(() => {});
  }

  // keep the server in sync with the start state chosen on the join screen
  useEffect(() => {
    if (phase !== "in" || !session) return;
    api.updateSelf(code, session.participantId, { is_muted: !media.micOn, is_video_on: media.videoOn }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === "in"]);

  async function toggleShare() {
    if (screen) {
      screen.getTracks().forEach((t) => t.stop());
      setScreen(null);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      s.getVideoTracks()[0].addEventListener("ended", () => setScreen(null)); // browser's "Stop sharing"
      setScreen(s);
    } catch {
      /* user cancelled the picker */
    }
  }

  async function leave() {
    if (!session) return;
    setLeaveOpen(false);
    await api.leave(code, session.participantId).catch(() => {});
    setPhase("left");
    if (isHost) router.push("/");
  }

  async function endForAll() {
    if (!session) return;
    setLeaveOpen(false);
    try {
      await api.endForAll(code, session.participantId);
      setPhase("left");
      router.push("/");
    } catch (e) {
      flash(e instanceof ApiError ? e.message : "Couldn't end the meeting.");
    }
  }

  async function muteAll() {
    if (!session) return;
    try {
      const { muted } = await api.muteAll(code, session.participantId);
      flash(muted ? `Muted ${muted} participant${muted > 1 ? "s" : ""}` : "Everyone is already muted");
      poll();
    } catch (e) {
      flash(e instanceof ApiError ? e.message : "Couldn't mute everyone.");
    }
  }

  async function remove(p: Participant) {
    if (!session || !confirm(`Remove ${p.display_name} from the meeting?`)) return;
    try {
      await api.remove(code, p.id, session.participantId);
      flash(`${p.display_name} was removed`);
      poll();
    } catch (e) {
      flash(e instanceof ApiError ? e.message : "Couldn't remove that participant.");
    }
  }

  async function sendMessage(text: string) {
    if (!session) return;
    const m = await api.sendMessage(code, session.participantId, text);
    lastMessageId.current = Math.max(lastMessageId.current, m.id);
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }

  /** Open/close a side panel. Opening or closing chat marks messages as read. */
  function togglePanel(next: Panel) {
    if (panel === "chat" || next === "chat") setSeenMessages(messages.length);
    setPanel(panel === next ? null : next);
  }

  function react(emoji: string) {
    setReactionsOpen(false);
    setReaction(emoji);
    setTimeout(() => setReaction(null), 5000);
  }

  // ------------------------------------------------------------- end states

  if (phase === "removed")
    return <CenteredMessage title="You have been removed from this meeting" body="The host removed you. You can't rejoin this meeting." />;
  if (phase === "ended")
    return <CenteredMessage title="This meeting has been ended by host" body="Thanks for joining. You can close this window or go back home." />;
  if (phase === "left" && !isHost)
    return (
      <CenteredMessage title="You left the meeting" body="Want to go back in? Open the invite link again or join with the meeting ID." />
    );
  if (!session || !meeting || phase === "loading" || phase === "left")
    return (
      <div className="flex min-h-screen items-center justify-center bg-room-bg text-room-muted" role="status">
        Connecting…
      </div>
    );

  // ------------------------------------------------------------- room

  const unread = panel === "chat" ? 0 : Math.max(0, messages.length - seenMessages);
  const others = participants.filter((p) => p.id !== meId);
  const tiles = [
    { id: meId, name: session.displayName, isHost, isMe: true, muted: !media.micOn },
    ...others.map((p) => ({ id: p.id, name: p.display_name, isHost: p.role === "host", isMe: false, muted: p.is_muted })),
  ];
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="flex h-dvh flex-col bg-room-bg text-white">
      {/* top bar */}
      <header className="flex h-10 shrink-0 items-center justify-between px-3 text-xs text-room-muted">
        <div className="flex min-w-0 items-center gap-2">
          <MeetingInfo meeting={meeting} />
          <span className="truncate text-white">{meeting.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="tabular-nums" aria-label="Time in meeting">
            {mm}:{ss}
          </span>
          <span className="hidden items-center gap-1.5 rounded-md border border-room-border px-2 py-1 sm:flex">
            <LayoutGrid size={14} /> Gallery
          </span>
        </div>
      </header>

      {screen && (
        <div className="mx-auto mb-1 flex items-center gap-3 rounded-md bg-zoom-green px-3 py-1 text-xs font-bold text-white">
          You are screen sharing
          <button onClick={toggleShare} className="rounded bg-zoom-red px-2 py-0.5 hover:bg-zoom-red-hover">
            Stop share
          </button>
        </div>
      )}

      {/* stage + side panel */}
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 p-2 sm:p-4">
          {screen ? (
            <>
              <div className="flex w-full justify-center gap-2 overflow-x-auto">
                {tiles.map((t) => (
                  <div key={t.id} className="w-40 shrink-0">
                    <VideoTile {...t} stream={t.isMe && media.videoOn ? media.videoStream : null} reaction={t.isMe ? reaction : null} />
                  </div>
                ))}
              </div>
              <ScreenView stream={screen} />
            </>
          ) : (
            <div className={`grid w-full gap-2 ${gridCols(tiles.length)} ${tiles.length === 1 ? "max-w-[1100px]" : "max-w-[1400px]"}`}>
              {tiles.map((t) => (
                <VideoTile key={t.id} {...t} stream={t.isMe && media.videoOn ? media.videoStream : null} reaction={t.isMe ? reaction : null} />
              ))}
            </div>
          )}
          {media.error && <p className="text-xs text-room-muted">{media.error}</p>}
        </main>

        {panel && (
          <div className="fixed inset-0 z-30 sm:static sm:z-auto sm:w-[320px] sm:shrink-0 sm:border-l sm:border-room-border">
            {panel === "participants" ? (
              <ParticipantsPanel
                participants={participants}
                meId={meId}
                isHost={isHost}
                inviteLink={meeting.invite_link}
                onClose={() => setPanel(null)}
                onMuteAll={muteAll}
                onRemove={remove}
              />
            ) : (
              <ChatPanel messages={messages} meId={meId} onSend={sendMessage} onClose={() => togglePanel("chat")} />
            )}
          </div>
        )}
      </div>

      {/* toolbar */}
      <footer className="relative flex h-[68px] shrink-0 items-center justify-between gap-1 bg-room-bg px-2 sm:px-3">
        <div className="flex items-center">
          <ToolbarButton
            icon={media.micOn ? Mic : MicOff}
            label={media.micOn ? "Mute" : "Unmute"}
            danger={!media.micOn}
            onClick={toggleMic}
          />
          <ToolbarButton
            icon={media.videoOn ? Video : VideoOff}
            label={media.videoOn ? "Stop Video" : "Start Video"}
            danger={!media.videoOn}
            onClick={toggleVideo}
          />
        </div>

        <div className="flex items-center overflow-x-auto">
          <ToolbarButton
            icon={Users}
            label="Participants"
            badge={participants.length}
            active={panel === "participants"}
            onClick={() => togglePanel("participants")}
          />
          <ToolbarButton
            icon={MessageSquare}
            label="Chat"
            badge={unread || undefined}
            active={panel === "chat"}
            onClick={() => togglePanel("chat")}
          />
          <ToolbarButton
            icon={MonitorUp}
            label={screen ? "Stop Share" : "Share"}
            onClick={toggleShare}
            className={screen ? "" : "[&_svg]:text-zoom-green"}
          />
          <ToolbarButton icon={CircleDot} label="Record" onClick={() => flash("Recording isn't available in this demo")} className="hidden md:flex" />
          <div className="relative">
            <ToolbarButton icon={Smile} label="Reactions" active={reactionsOpen} onClick={() => setReactionsOpen((o) => !o)} />
            {reactionsOpen && (
              <div className="animate-pop absolute bottom-[64px] left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-xl bg-room-panel p-2 shadow-2xl ring-1 ring-room-border">
                {REACTIONS.map((e) => (
                  <button key={e} onClick={() => react(e)} className="rounded-lg p-1.5 text-2xl hover:bg-room-hover" aria-label={`React ${e}`}>
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ToolbarButton icon={Ellipsis} label="More" onClick={() => flash("More options coming soon")} className="hidden md:flex" />
        </div>

        <div className="relative">
          <button
            onClick={() => setLeaveOpen((o) => !o)}
            className="rounded-lg bg-zoom-red px-4 py-1.5 text-sm font-bold hover:bg-zoom-red-hover"
          >
            {isHost ? "End" : "Leave"}
          </button>
          {leaveOpen && (
            <div className="animate-pop absolute right-0 bottom-[52px] z-30 w-[260px] rounded-xl bg-room-panel p-3 shadow-2xl ring-1 ring-room-border">
              {isHost && (
                <button onClick={endForAll} className="mb-2 w-full rounded-lg bg-zoom-red py-2 text-sm font-bold hover:bg-zoom-red-hover">
                  End meeting for all
                </button>
              )}
              <button onClick={leave} className="w-full rounded-lg bg-room-hover py-2 text-sm font-bold hover:bg-[#3d3d3d]">
                Leave meeting
              </button>
              <button onClick={() => setLeaveOpen(false)} className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-room-muted hover:text-white">
                <ChevronUp size={14} className="rotate-180" /> Cancel
              </button>
            </div>
          )}
        </div>
      </footer>

      {toast && (
        <div role="status" className="animate-pop fixed top-14 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-zoom-text shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function ScreenView({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className="min-h-0 w-full max-w-[1400px] flex-1 rounded-lg bg-black object-contain" />;
}
