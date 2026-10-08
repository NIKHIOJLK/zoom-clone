"use client";

import { Check, Copy, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Meeting } from "@/lib/api";
import { formatMeetingId } from "@/lib/format";

/** The green shield at the top-left of the room; opens meeting ID, passcode and invite link. */
export default function MeetingInfo({ meeting }: { meeting: Meeting }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function copy() {
    await navigator.clipboard.writeText(meeting.invite_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Meeting information"
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-room-hover"
      >
        <ShieldCheck size={18} className="text-zoom-green" fill="currentColor" stroke="#1a1a1a" />
      </button>
      {open && (
        <div className="animate-pop absolute top-9 left-0 z-30 w-[320px] rounded-xl bg-white p-4 text-sm text-zoom-text shadow-2xl">
          <p className="text-base font-bold">{meeting.title}</p>
          <dl className="mt-3 grid grid-cols-[96px_1fr] gap-y-2">
            <dt className="text-zoom-muted">Meeting ID</dt>
            <dd>{formatMeetingId(meeting.meeting_code)}</dd>
            <dt className="text-zoom-muted">Host</dt>
            <dd>{meeting.host_name}</dd>
            <dt className="text-zoom-muted">Passcode</dt>
            <dd>{meeting.passcode}</dd>
            <dt className="text-zoom-muted">Invite link</dt>
            <dd className="min-w-0">
              <span className="block truncate text-zoom-blue">{meeting.invite_link}</span>
              <button onClick={copy} className="mt-1 flex items-center gap-1 text-xs font-bold text-zoom-blue hover:underline">
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy link"}
              </button>
            </dd>
          </dl>
          <p className="mt-3 flex items-center gap-1.5 border-t border-zoom-border pt-3 text-xs text-zoom-muted">
            <ShieldCheck size={14} className="text-zoom-green" /> Passcode protected meeting
          </p>
        </div>
      )}
    </div>
  );
}
