"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, type User } from "@/lib/api";
import { saveSession } from "@/lib/session";

/**
 * "New meeting" and "Start" both end the same way: join as the host and go to the room.
 */
export function useStartMeeting(user: User | null) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enterAsHost(code: string) {
    if (!user) return;
    const p = await api.join(code, user.name, user.id);
    saveSession(code, {
      participantId: p.id,
      displayName: p.display_name,
      role: p.role,
      startMuted: false,
      startVideoOff: false,
    });
    router.push(`/meeting/${code}`);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return {
    busy,
    error,
    clearError: () => setError(null),
    /** Create an instant meeting and enter it. */
    newMeeting: () =>
      run(async () => {
        const m = await api.createInstant();
        await enterAsHost(m.meeting_code);
      }),
    /** Start an existing (scheduled) meeting as its host. */
    startMeeting: (code: string) => run(() => enterAsHost(code)),
  };
}
