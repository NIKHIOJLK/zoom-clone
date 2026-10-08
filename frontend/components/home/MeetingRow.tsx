"use client";

import { Check, Copy, Ellipsis, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Meeting } from "@/lib/api";
import { formatMeetingId, invitationText, timeRange } from "@/lib/format";

type Props = {
  meeting: Meeting;
  onStart: (code: string) => void;
  onDelete: (code: string) => void;
  busy?: boolean;
};

/** One upcoming meeting: time, topic, ID, Start button and a "…" menu. */
export default function MeetingRow({ meeting: m, onStart, onDelete, busy }: Props) {
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const live = m.status === "live";

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  async function copy() {
    await navigator.clipboard.writeText(invitationText(m));
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setMenu(false);
    }, 1200);
  }

  return (
    <li className="group flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-zoom-surface">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-zoom-muted">
          {m.scheduled_start && timeRange(m.scheduled_start, m.duration_minutes)}
          {live && <span className="ml-2 rounded bg-zoom-green/15 px-1.5 py-0.5 font-bold text-[#067647]">In progress</span>}
        </p>
        <p className="truncate font-bold text-zoom-text">{m.title}</p>
        <p className="text-xs text-zoom-muted">Meeting ID: {formatMeetingId(m.meeting_code)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 pt-1" ref={ref}>
        <button
          onClick={() => onStart(m.meeting_code)}
          disabled={busy}
          className="rounded-lg bg-zoom-blue px-3 py-1.5 text-xs font-bold text-white hover:bg-zoom-blue-hover disabled:opacity-50"
        >
          {live ? "Join" : "Start"}
        </button>
        <div className="relative">
          <button
            aria-label={`More options for ${m.title}`}
            onClick={() => setMenu((o) => !o)}
            className="rounded-lg p-1.5 text-zoom-muted hover:bg-black/[.06] hover:text-zoom-text"
          >
            <Ellipsis size={18} />
          </button>
          {menu && (
            <div className="animate-pop absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-zoom-border bg-white py-1 shadow-lg">
              <button onClick={copy} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zoom-surface">
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy invitation"}
              </button>
              <button
                onClick={() => {
                  setMenu(false);
                  onDelete(m.meeting_code);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zoom-red hover:bg-zoom-surface"
              >
                <Trash2 size={15} /> Delete meeting
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
