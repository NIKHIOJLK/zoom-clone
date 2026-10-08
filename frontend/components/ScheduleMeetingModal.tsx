"use client";

import { format } from "date-fns";
import { CalendarDays, Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import Modal, { PrimaryButton, SecondaryButton } from "./Modal";
import { api, ApiError, type Meeting, type User } from "@/lib/api";
import { durationLabel, formatMeetingId, invitationText, timeRange } from "@/lib/format";

type Props = { user: User | null; onClose: () => void; onScheduled: (m: Meeting) => void };

/** Next half hour from now, e.g. 11:38 -> 12:00 */
function nextSlot(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return d;
}

// 15-minute time options, like Zoom's time dropdown
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const label = format(new Date(2000, 0, 1, h, m), "h:mm a");
  return { value, label };
});

export default function ScheduleMeetingModal({ user, onClose, onScheduled }: Props) {
  const start = useMemo(() => nextSlot(), []);
  const [title, setTitle] = useState(user ? `${user.name}'s Zoom Meeting` : "My Meeting");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(start, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(start, "HH:mm"));
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Meeting | null>(null);
  const [copied, setCopied] = useState(false);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const duration = hours * 60 + minutes;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Enter a topic for your meeting.");
    if (duration < 5) return setError("Duration must be at least 5 minutes.");
    // date + time are local; toISOString() converts to UTC for the API
    const startsAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(startsAt.getTime())) return setError("Pick a valid date and time.");
    if (startsAt.getTime() < Date.now() - 60_000) return setError("Choose a start time in the future.");

    setBusy(true);
    try {
      const m = await api.schedule({
        title: title.trim(),
        description: description.trim(),
        scheduled_start: startsAt.toISOString(),
        duration_minutes: duration,
      });
      setCreated(m);
      onScheduled(m);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't schedule the meeting. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!created) return;
    await navigator.clipboard.writeText(invitationText(created));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (created) {
    return (
      <Modal
        title="Meeting scheduled"
        onClose={onClose}
        width={480}
        footer={
          <>
            <SecondaryButton onClick={copyInvite}>
              <span className="inline-flex items-center gap-1.5">
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copied" : "Copy invitation"}
              </span>
            </SecondaryButton>
            <PrimaryButton onClick={onClose}>Done</PrimaryButton>
          </>
        }
      >
        <div className="flex gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zoom-blue-soft text-zoom-blue">
            <CalendarDays size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[17px] font-bold">{created.title}</p>
            <p className="text-sm text-zoom-muted">
              {format(new Date(created.scheduled_start!), "EEEE, MMMM d")} · {timeRange(created.scheduled_start!, created.duration_minutes)}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 rounded-lg bg-zoom-surface p-4 text-sm">
          <dt className="text-zoom-muted">Meeting ID</dt>
          <dd className="font-bold">{formatMeetingId(created.meeting_code)}</dd>
          <dt className="text-zoom-muted">Passcode</dt>
          <dd className="font-bold">{created.passcode}</dd>
          <dt className="text-zoom-muted">Invite link</dt>
          <dd className="break-all text-zoom-blue">{created.invite_link}</dd>
        </dl>
      </Modal>
    );
  }

  return (
    <Modal
      title="Schedule meeting"
      onClose={onClose}
      width={560}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" form="schedule-form" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </PrimaryButton>
        </>
      }
    >
      <form id="schedule-form" onSubmit={save} className="space-y-4 text-sm">
        <Field label="Topic">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputCls} />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Add meeting agenda"
            className={`${inputCls} resize-none`}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date">
            <input type="date" value={date} min={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Time">
            <select value={time} onChange={(e) => setTime(e.target.value)} className={inputCls}>
              {TIME_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Duration">
          <div className="flex items-center gap-2">
            <select aria-label="Hours" value={hours} onChange={(e) => setHours(Number(e.target.value))} className={`${inputCls} w-24`}>
              {Array.from({ length: 25 }, (_, h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-zoom-muted">hr</span>
            <select aria-label="Minutes" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={`${inputCls} w-24`}>
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="text-zoom-muted">min</span>
          </div>
        </Field>

        <p className="text-zoom-muted">
          Time zone: <span className="text-zoom-text">{timeZone}</span>
        </p>

        <div role="radiogroup" aria-label="Meeting ID" className="space-y-2 border-t border-zoom-border pt-4">
          <p className="mb-2 font-bold">Meeting ID</p>
          <label className="flex items-center gap-2.5">
            <input type="radio" checked readOnly className="accent-zoom-blue" /> Generate automatically
          </label>
          <label className="flex items-center gap-2.5 text-zoom-muted">
            <input type="radio" disabled /> Personal Meeting ID
          </label>
        </div>

        <div className="space-y-2 border-t border-zoom-border pt-4">
          <p className="mb-2 font-bold">Security</p>
          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked readOnly className="h-4 w-4 accent-zoom-blue" /> Passcode
            <span className="text-zoom-muted">(generated when you save)</span>
          </label>
        </div>

        {error && (
          <p role="alert" className="text-zoom-red">
            {error}
          </p>
        )}
        <p className="text-xs text-zoom-muted">Ends {durationLabel(duration)} after it starts.</p>
      </form>
    </Modal>
  );
}

const inputCls =
  "w-full rounded-lg border border-zoom-border bg-white px-3 py-2 text-[14px] outline-none focus:border-zoom-blue";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-zoom-text">{label}</span>
      {children}
    </label>
  );
}
