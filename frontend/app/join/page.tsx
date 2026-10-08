"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import TopNav from "@/components/TopNav";
import { api, ApiError } from "@/lib/api";
import { extractMeetingCode } from "@/lib/format";

// /join — standalone "Join a meeting" page (like zoom.us/join)
export default function JoinPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const code = extractMeetingCode(value);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.getMeeting(code);
      router.push(`/join/${code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't find that meeting.");
      setBusy(false);
    }
  }

  return (
    <>
      <TopNav />
      <main className="flex flex-1 items-start justify-center bg-zoom-surface px-4 pt-20">
        <form onSubmit={submit} className="w-full max-w-[400px] rounded-2xl border border-zoom-border bg-white p-8">
          <h1 className="text-2xl font-bold">Join meeting</h1>
          <label htmlFor="meeting-id" className="mt-6 mb-1.5 block text-sm font-bold">
            Meeting ID or invite link
          </label>
          <input
            id="meeting-id"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="Enter Meeting ID or invite link"
            className={`w-full rounded-lg border px-3 py-2.5 outline-none focus:border-zoom-blue ${error ? "border-zoom-red" : "border-zoom-border"}`}
          />
          {error && (
            <p role="alert" className="mt-2 text-sm text-zoom-red">
              {error}
            </p>
          )}
          <button
            disabled={code.length < 9 || busy}
            className="mt-5 w-full rounded-lg bg-zoom-blue py-2.5 font-bold text-white hover:bg-zoom-blue-hover disabled:opacity-40"
          >
            {busy ? "Checking…" : "Join"}
          </button>
        </form>
      </main>
    </>
  );
}
