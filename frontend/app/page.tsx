"use client";

import { ArrowUp, CalendarDays, Plus, Video } from "lucide-react";
import { useEffect, useState } from "react";
import TopNav from "@/components/TopNav";
import ActionTile from "@/components/home/ActionTile";
import RecentMeetings from "@/components/home/RecentMeetings";
import UpcomingCard from "@/components/home/UpcomingCard";
import JoinMeetingModal from "@/components/JoinMeetingModal";
import ScheduleMeetingModal from "@/components/ScheduleMeetingModal";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import { useNowSeconds } from "@/hooks/useBrowserValue";
import { api, ApiError, type Meeting } from "@/lib/api";

export default function HomePage() {
  const user = useCurrentUser();
  const { newMeeting, startMeeting, busy, error, clearError } = useStartMeeting(user);
  const [upcoming, setUpcoming] = useState<Meeting[] | null>(null);
  const [recent, setRecent] = useState<Meeting[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<"join" | "schedule" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  // fetch both lists on mount and whenever load() is called
  useEffect(() => {
    let ignore = false;
    Promise.all([api.upcoming(), api.recent()])
      .then(([u, r]) => {
        if (ignore) return;
        setUpcoming(u);
        setRecent(r);
        setLoadError(null);
      })
      .catch((e) => {
        if (ignore) return;
        setLoadError(e instanceof ApiError ? e.message : "Couldn't load your meetings.");
        setUpcoming([]);
        setRecent([]);
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  async function deleteMeeting(code: string) {
    if (!confirm("Delete this meeting? Anyone with the invite won't be able to join.")) return;
    try {
      await api.deleteMeeting(code);
      setUpcoming((list) => list?.filter((m) => m.meeting_code !== code) ?? null);
      setNotice("Meeting deleted");
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "Couldn't delete the meeting.");
    }
  }

  // day-of-month on the Schedule tile; computed in the browser so it's never the build date
  const nowSec = useNowSeconds();
  const today = nowSec ? String(new Date(nowSec * 1000).getDate()) : undefined;

  return (
    <>
      <TopNav />
      <main className="flex-1 bg-white">
        {loadError && (
          <div role="alert" className="border-b border-[#fecdca] bg-[#fef3f2] px-5 py-2.5 text-center text-sm text-[#b42318]">
            {loadError}{" "}
            <button onClick={load} className="font-bold underline">
              Retry
            </button>
          </div>
        )}

        <div className="mx-auto grid max-w-[1080px] gap-10 px-4 py-8 sm:px-8 md:py-14 lg:grid-cols-[1fr_440px] lg:gap-14">
          <div className="flex flex-col items-center gap-12">
            <div className="grid grid-cols-2 gap-x-10 gap-y-8 pt-2 sm:gap-x-14 lg:pt-10">
              <ActionTile label="New meeting" icon={Video} color="orange" onClick={newMeeting} disabled={busy || !user} />
              <ActionTile label="Join" icon={Plus} color="blue" onClick={() => setModal("join")} />
              <ActionTile label="Schedule" icon={CalendarDays} color="blue" onClick={() => setModal("schedule")} badge={today} />
              <ActionTile label="Share screen" icon={ArrowUp} color="blue" onClick={() => setModal("join")} />
            </div>
            {busy && <p className="-mt-6 text-sm text-zoom-muted">Starting your meeting…</p>}
            {error && (
              <p role="alert" className="-mt-6 text-sm text-zoom-red">
                {error}{" "}
                <button className="underline" onClick={clearError}>
                  Dismiss
                </button>
              </p>
            )}
            <div className="w-full max-w-[520px]">
              <RecentMeetings meetings={recent} />
            </div>
          </div>

          <UpcomingCard
            meetings={upcoming}
            onStart={startMeeting}
            onDelete={deleteMeeting}
            onSchedule={() => setModal("schedule")}
            busy={busy}
          />
        </div>
      </main>

      {modal === "join" && <JoinMeetingModal user={user} onClose={() => setModal(null)} />}
      {modal === "schedule" && (
        <ScheduleMeetingModal
          user={user}
          onClose={() => setModal(null)}
          onScheduled={() => {
            load();
          }}
        />
      )}

      {notice && (
        <div role="status" className="animate-pop fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-zoom-text px-4 py-2.5 text-sm text-white shadow-lg">
          {notice}
        </div>
      )}
    </>
  );
}
