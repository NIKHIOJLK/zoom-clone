"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Modal, { PrimaryButton, SecondaryButton } from "./Modal";
import { api, ApiError, type User } from "@/lib/api";
import { extractMeetingCode } from "@/lib/format";
import { rememberedName, rememberName, saveSession } from "@/lib/session";

type Props = { user: User | null; onClose: () => void };

/** Zoom desktop "Join meeting" dialog: ID or link, your name, and audio/video options. */
export default function JoinMeetingModal({ user, onClose }: Props) {
  const router = useRouter();
  const [idOrLink, setIdOrLink] = useState("");
  const [name, setName] = useState(() => rememberedName() || user?.name || "");
  const [remember, setRemember] = useState(true);
  const [noAudio, setNoAudio] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const code = extractMeetingCode(idOrLink);
  const canJoin = code.length >= 9 && name.trim().length > 0 && !busy;

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!canJoin) return;
    setBusy(true);
    setError(null);
    try {
      const meeting = await api.getMeeting(code); // validates the meeting exists
      if (meeting.status === "ended") throw new ApiError(410, "This meeting has ended.");
      const p = await api.join(code, name.trim(), user?.id);
      if (remember) rememberName(name.trim());
      saveSession(code, {
        participantId: p.id,
        displayName: p.display_name,
        role: p.role,
        startMuted: noAudio,
        startVideoOff: videoOff,
      });
      router.push(`/meeting/${code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to join. Try again.");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Join meeting"
      onClose={onClose}
      width={420}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" form="join-form" disabled={!canJoin}>
            {busy ? "Joining…" : "Join"}
          </PrimaryButton>
        </>
      }
    >
      <form id="join-form" onSubmit={join} className="space-y-3">
        <input
          aria-label="Meeting ID or invite link"
          value={idOrLink}
          onChange={(e) => {
            setIdOrLink(e.target.value);
            setError(null);
          }}
          placeholder="Meeting ID or invite link"
          className={`w-full rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-zoom-blue ${
            error ? "border-zoom-red" : "border-zoom-border"
          }`}
        />
        <input
          aria-label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={60}
          className="w-full rounded-lg border border-zoom-border px-3 py-2.5 text-[15px] outline-none focus:border-zoom-blue"
        />
        {error && (
          <p role="alert" className="text-sm text-zoom-red">
            {error}
          </p>
        )}
        <div className="space-y-2 pt-1 text-sm">
          <Check label="Remember my name for future meetings" checked={remember} onChange={setRemember} />
          <Check label="Don't connect to audio" checked={noAudio} onChange={setNoAudio} />
          <Check label="Turn off my video" checked={videoOff} onChange={setVideoOff} />
        </div>
        <p className="pt-1 text-xs text-zoom-muted">
          Try a sample ID: <button type="button" className="font-bold text-zoom-blue hover:underline" onClick={() => setIdOrLink("847 291 6305")}>847 291 6305</button>
        </p>
      </form>
    </Modal>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-zoom-text">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-zoom-blue" />
      {label}
    </label>
  );
}
