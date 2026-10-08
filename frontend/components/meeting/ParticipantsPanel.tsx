"use client";

import { Check, Link2, Mic, MicOff, UserMinus, Video, VideoOff, X } from "lucide-react";
import { useState } from "react";
import Avatar from "../Avatar";
import type { Participant } from "@/lib/api";

type Props = {
  participants: Participant[];
  meId: number;
  isHost: boolean;
  inviteLink: string;
  onClose: () => void;
  onMuteAll: () => void;
  onRemove: (p: Participant) => void;
};

/** Right-side panel listing everyone in the meeting, with host controls. */
export default function ParticipantsPanel({ participants, meId, isHost, inviteLink, onClose, onMuteAll, onRemove }: Props) {
  const [copied, setCopied] = useState(false);
  // me first, then host, then everyone else by join time
  const sorted = [...participants].sort(
    (a, b) => Number(b.id === meId) - Number(a.id === meId) || Number(b.role === "host") - Number(a.role === "host"),
  );

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <aside aria-label="Participants" className="flex h-full w-full flex-col bg-white text-zoom-text">
      <div className="flex items-center justify-between border-b border-zoom-border px-4 py-3">
        <h2 className="text-sm font-bold">Participants ({participants.length})</h2>
        <button onClick={onClose} aria-label="Close participants" className="rounded p-1 text-zoom-muted hover:bg-zoom-surface">
          <X size={18} />
        </button>
      </div>

      <ul className="thin-scroll flex-1 overflow-y-auto py-1">
        {sorted.map((p) => {
          const isMe = p.id === meId;
          return (
            <li key={p.id} className="group flex items-center gap-2.5 px-4 py-2 hover:bg-zoom-surface">
              <Avatar name={p.display_name} size={30} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {p.display_name}
                <span className="text-zoom-muted">
                  {p.role === "host" && isMe ? " (Host, me)" : p.role === "host" ? " (Host)" : isMe ? " (me)" : ""}
                </span>
              </span>
              {isHost && !isMe && p.role !== "host" && (
                <button
                  onClick={() => onRemove(p)}
                  className="hidden items-center gap-1 rounded-md border border-zoom-border bg-white px-2 py-1 text-xs font-bold text-zoom-red group-hover:flex focus:flex"
                >
                  <UserMinus size={13} /> Remove
                </button>
              )}
              {p.is_muted ? <MicOff size={16} className="text-zoom-red" aria-label="muted" /> : <Mic size={16} className="text-zoom-muted" aria-label="unmuted" />}
              {p.is_video_on ? <Video size={16} className="text-zoom-muted" aria-label="video on" /> : <VideoOff size={16} className="text-zoom-red" aria-label="video off" />}
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2 border-t border-zoom-border p-3">
        <button onClick={copyInvite} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zoom-border py-2 text-sm font-bold hover:bg-zoom-surface">
          {copied ? <Check size={15} /> : <Link2 size={15} />} {copied ? "Link copied" : "Invite"}
        </button>
        {isHost && (
          <button onClick={onMuteAll} className="flex-1 rounded-lg border border-zoom-border py-2 text-sm font-bold hover:bg-zoom-surface">
            Mute all
          </button>
        )}
      </div>
    </aside>
  );
}
