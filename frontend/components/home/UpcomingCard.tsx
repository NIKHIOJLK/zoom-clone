"use client";

import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useNowSeconds } from "@/hooks/useBrowserValue";
import MeetingRow from "./MeetingRow";
import type { Meeting } from "@/lib/api";
import { dayLabel } from "@/lib/format";

type Props = {
  meetings: Meeting[] | null; // null = still loading
  onStart: (code: string) => void;
  onDelete: (code: string) => void;
  onSchedule: () => void;
  busy?: boolean;
};

/** Right side of Home: a live clock header, then upcoming meetings grouped by day. */
export default function UpcomingCard({ meetings, onStart, onDelete, onSchedule, busy }: Props) {
  // null on the server, live time in the browser (avoids hydration mismatch)
  const seconds = useNowSeconds();
  const now = seconds === null ? null : new Date(seconds * 1000);

  const groups = new Map<string, Meeting[]>();
  for (const m of meetings ?? []) {
    const key = dayLabel(m.scheduled_start!);
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }

  return (
    <section aria-labelledby="upcoming-heading" className="overflow-hidden rounded-2xl border border-zoom-border bg-white">
      <div className="relative h-[150px] overflow-hidden bg-[linear-gradient(135deg,#0b5cff_0%,#3d7bff_45%,#7aa5ff_100%)] px-6 py-5 text-white">
        {/* soft shapes for depth, purely decorative */}
        <span aria-hidden className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <span aria-hidden className="absolute right-24 top-20 h-40 w-40 rounded-full bg-white/[.07]" />
        <p className="relative text-[44px] leading-none font-bold tabular-nums">
          {now ? format(now, "h:mm a") : " "}
        </p>
        <p className="relative mt-2 text-[15px] text-white/90">{now ? format(now, "EEEE, MMMM d") : " "}</p>
      </div>

      <div className="px-3 pt-4 pb-3">
        <h2 id="upcoming-heading" className="px-3 pb-1 text-[15px] font-bold">
          Upcoming meetings
        </h2>

        {meetings === null ? (
          <ul aria-label="Loading" className="space-y-2 px-3 py-2">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-14 animate-pulse rounded-lg bg-zoom-surface" />
            ))}
          </ul>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-8 text-center">
            <CalendarDays size={36} className="text-zoom-border" />
            <p className="mt-3 font-bold">No upcoming meetings</p>
            <p className="mt-1 text-sm text-zoom-muted">Meetings you schedule show up here.</p>
            <button onClick={onSchedule} className="mt-3 text-sm font-bold text-zoom-blue hover:underline">
              Schedule a meeting
            </button>
          </div>
        ) : (
          <div className="thin-scroll max-h-[420px] overflow-y-auto">
            {[...groups.entries()].map(([day, items]) => (
              <div key={day} className="pt-2">
                <h3 className="px-3 pb-1 text-xs font-bold text-zoom-muted">{day}</h3>
                <ul>
                  {items.map((m) => (
                    <MeetingRow key={m.id} meeting={m} onStart={onStart} onDelete={onDelete} busy={busy} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
