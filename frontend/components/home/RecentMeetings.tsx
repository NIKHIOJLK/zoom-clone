import { format } from "date-fns";
import { History, Users, Video } from "lucide-react";
import type { Meeting } from "@/lib/api";
import { durationLabel, formatMeetingId } from "@/lib/format";

/** Meetings that have ended, newest first. */
export default function RecentMeetings({ meetings }: { meetings: Meeting[] | null }) {
  return (
    <section aria-labelledby="recent-heading" className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="recent-heading" className="text-[15px] font-bold">
          Recent meetings
        </h2>
      </div>

      {meetings === null ? (
        <ul aria-label="Loading" className="space-y-2">
          {[0, 1].map((i) => (
            <li key={i} className="h-[60px] animate-pulse rounded-lg bg-zoom-surface" />
          ))}
        </ul>
      ) : meetings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zoom-border px-4 py-6 text-center text-sm text-zoom-muted">
          <History size={18} className="mx-auto mb-2" />
          Meetings you&apos;ve attended will appear here once they end.
        </p>
      ) : (
        <ul className="divide-y divide-zoom-border overflow-hidden rounded-xl border border-zoom-border bg-white">
          {meetings.map((m) => {
            const minutes =
              m.started_at && m.ended_at
                ? Math.max(1, Math.round((+new Date(m.ended_at) - +new Date(m.started_at)) / 60000))
                : m.duration_minutes;
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zoom-surface text-zoom-muted">
                  <Video size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{m.title}</p>
                  <p className="truncate text-xs text-zoom-muted">
                    {m.ended_at && format(new Date(m.ended_at), "MMM d, h:mm a")} · {durationLabel(minutes)} · ID{" "}
                    {formatMeetingId(m.meeting_code)}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs text-zoom-muted" title="Participants">
                  <Users size={14} /> {m.total_participants}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
