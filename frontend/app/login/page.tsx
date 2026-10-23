"use client";

import { Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PrimaryButton } from "@/components/Modal";
import { resetCurrentUser } from "@/hooks/useCurrentUser";
import { api, ApiError } from "@/lib/api";
import { setToken } from "@/lib/auth";

const DEMO = { email: "nikhil.sharma@example.com", password: "demo1234" };

/** Sign in / create account. Guests joining by invite link never need this page. */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(creds?: { email: string; password: string }) {
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "signup" && !creds
          ? await api.signup(name.trim(), email.trim(), password)
          : await api.login((creds ?? { email, password }).email.trim(), (creds ?? { email, password }).password);
      setToken(res.access_token);
      resetCurrentUser(res.user);
      // go back to the page that sent us here (only same-site paths)
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-zoom-border px-3 py-2.5 text-[15px] outline-none focus:border-zoom-blue focus:ring-2 focus:ring-zoom-blue-soft";

  return (
    <main className="flex min-h-screen flex-col items-center bg-zoom-surface px-4 py-10 sm:justify-center">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zoom-blue text-white">
          <Video size={22} fill="currentColor" strokeWidth={1.5} />
        </span>
        <span className="text-2xl font-black tracking-tight">Zoom Clone</span>
      </div>

      <div className="w-full max-w-[400px] rounded-2xl border border-zoom-border bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-[22px] font-bold">{mode === "signin" ? "Sign in" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-zoom-muted">
          {mode === "signin" ? "Welcome back. Sign in to host and schedule meetings." : "It takes less than a minute."}
        </p>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {mode === "signup" && (
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Name</span>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={100} />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Email</span>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Password</span>
            <input
              className={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
            {mode === "signup" && <span className="mt-1 block text-xs text-zoom-muted">At least 8 characters.</span>}
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-zoom-red">
              {error}
            </p>
          )}

          <PrimaryButton type="submit" disabled={busy} className="w-full !py-2.5 !text-[15px]">
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </PrimaryButton>
        </form>

        {mode === "signin" && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-zoom-muted">
              <span className="h-px flex-1 bg-zoom-border" /> or <span className="h-px flex-1 bg-zoom-border" />
            </div>
            <button
              onClick={() => submit(DEMO)}
              disabled={busy}
              className="w-full rounded-lg border border-zoom-border bg-white py-2.5 text-[15px] font-bold hover:bg-zoom-surface disabled:opacity-50"
            >
              Use demo account
            </button>
            <p className="mt-2 text-center text-xs text-zoom-muted">
              {DEMO.email} · {DEMO.password}
            </p>
          </>
        )}

        <p className="mt-6 text-center text-sm text-zoom-muted">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="font-bold text-zoom-blue hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>

      <p className="mt-6 text-sm text-zoom-muted">
        Joining a meeting? You don&apos;t need an account:{" "}
        <Link href="/join" className="font-bold text-zoom-blue hover:underline">
          join with a meeting ID
        </Link>
      </p>
    </main>
  );
}
