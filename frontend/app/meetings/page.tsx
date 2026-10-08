"use client";

import { format } from "date-fns";
import { Check, Copy, Plus, Trash2, Users, Video } from "lucide-react";
import { useEffect, useState } from "react";
import TopNav from "@/components/TopNav";
import ScheduleMeetingModal from "@/components/ScheduleMeetingModal";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import { api, type Meeting } from "@/lib/api";
import { dayLabel, durationLabel, formatMeetingId, invitationText, timeRange } from "@/lib/format";

type Tab = "upcoming" | "previous";

/** Zoom's "Meetings" tab: list on the left, details of the selected meeting on the right. */
export default function MeetingsPage() {
  const user = useCurrentUser();
  const { startMeeting, busy } = useStartMeeting(user);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [previous, setPrevious] = useState<Meeting[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [copied, setCopied] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.upcoming(), api.recent()])
      .then(([u, p]) => {
        if (ignore) return;
        setUpcoming(u);
        setPrevious(p);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const list = tab === "upcoming" ? upcoming : previous;
  const selected = list.find((m) => m.id === selectedId) ?? list[0] ?? null;

  async function remove(m: Meeting) {
    if (!confirm(`Delete "${m.title}"?`)) return;
    await api.deleteMeeting(m.meeting_code).catch(() => {});
    load();
  }

  async function copy(m: Meeting) {
    await navigator.clipboard.writeText(invitationText(m));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <TopNav />
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="flex w-full flex-col border-zoom-border md:w-[340px] md:border-r">
          <div className="flex items-center justify-between px-4 pt-4">
            <h1 className="text-lg font-bold">Meetings</h1>
            <button
              onClick={() => setScheduling(true)}
              aria-label="Schedule a meeting"
              className="rounded-lg p-1.5 text-zoom-muted hover:bg-zoom-surface hover:text-zoom-text"
            >
              <Plus size={20} />
            </button>
          </div>
          <div role="tablist" className="mx-4 mt-3 grid grid-cols-2 rounded-lg bg-zoom-surface p-1 text-sm font-bold">
            {(["upcoming", "previous"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setSelectedId(null);
                }}
                className={`rounded-md py-1.5 capitalize ${tab === t ? "bg-white text-zoom-text shadow-sm" : "text-zoom-muted"}`}
              >
                {t}
              </button>
            ))}
          </div>

          <ul className="thin-scroll mt-2 flex-1 overflow-y-auto px-2 pb-4">
            {list.length === 0 && (
              <li className="px-3 py-10 text-center text-sm text-zoom-muted">
                {tab === "upcoming" ? "No upcoming meetings" : "No previous meetings"}
              </li>
            )}
            {list.map((m) => {
              const when = tab === "upcoming" ? m.scheduled_start : m.ended_at;
              return (
                <li key={m.id}>
                  <button
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full rounded-lg px-3 py-2.5 text-left ${
                      selected?.id === m.id ? "bg-zoom-blue-soft" : "hover:bg-zoom-surface"
                    }`}
                  >
                    <p className="text-xs text-zoom-muted">
                      {when && `${dayLabel(when)} · ${format(new Date(when), "h:mm a")}`}
                    </p>
                    <p className="truncate text-sm font-bold">{m.title}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex-1 border-t border-zoom-border p-6 md:border-t-0 md:p-10">
          {!selected ? (
            <p className="pt-20 text-center text-zoom-muted">Select a meeting to see its details.</p>
          ) : (
            <div className="max-w-[640px]">
              <h2 className="text-2xl font-bold">{selected.title}</h2>
              <p className="mt-1 text-zoom-muted">
                {selected.scheduled_start
                  ? `${format(new Date(selected.scheduled_start), "EEEE, MMMM d")} · ${timeRange(selected.scheduled_start, selected.duration_minutes)}`
                  : selected.started_at && `Started ${format(new Date(selected.started_at), "EEEE, MMMM d · h:mm a")}`}
              </p>

              {tab === "upcoming" && (
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    onClick={() => startMeeting(selected.meeting_code)}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-lg bg-zoom-blue px-5 py-2 text-sm font-bold text-white hover:bg-zoom-blue-hover disabled:opacity-50"
                  >
                    <Video size={16} /> {selected.status === "live" ? "Join" : "Start"}
                  </button>
                  <button
                    onClick={() => copy(selected)}
                    className="flex items-center gap-2 rounded-lg border border-zoom-border px-4 py-2 text-sm font-bold hover:bg-zoom-surface"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy invitation"}
                  </button>
                  <button
                    onClick={() => remove(selected)}
                    className="flex items-center gap-2 rounded-lg border border-zoom-border px-4 py-2 text-sm font-bold text-zoom-red hover:bg-zoom-surface"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              )}

              <dl className="mt-8 grid grid-cols-[140px_1fr] gap-y-3 border-t border-zoom-border pt-6 text-sm">
                <dt className="text-zoom-muted">Meeting ID</dt>
                <dd>{formatMeetingId(selected.meeting_code)}</dd>
                <dt className="text-zoom-muted">Passcode</dt>
                <dd>{selected.passcode}</dd>
                <dt className="text-zoom-muted">Duration</dt>
                <dd>{durationLabel(selected.duration_minutes)}</dd>
                <dt className="text-zoom-muted">Host</dt>
                <dd>{selected.host_name}</dd>
                {tab === "previous" && (
                  <>
                    <dt className="text-zoom-muted">Participants</dt>
                    <dd className="flex items-center gap-1.5">
                      <Users size={14} /> {selected.total_participants}
                    </dd>
                  </>
                )}
                <dt className="text-zoom-muted">Invite link</dt>
                <dd className="break-all text-zoom-blue">{selected.invite_link}</dd>
                {selected.description && (
                  <>
                    <dt className="text-zoom-muted">Description</dt>
                    <dd className="whitespace-pre-wrap">{selected.description}</dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </section>
      </main>

      {scheduling && (
        <ScheduleMeetingModal
          user={user}
          onClose={() => setScheduling(false)}
          onScheduled={(m) => {
            load();
            setTab("upcoming");
            setSelectedId(m.id);
          }}
        />
      )}
    </>
  );
}
