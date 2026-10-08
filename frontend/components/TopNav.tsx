"use client";

import { Bell, CalendarDays, ContactRound, House, MessageCircle, Search, Settings, Video } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: null, label: "Team Chat", icon: MessageCircle },
  { href: null, label: "Contacts", icon: ContactRound },
] as const;

/** Top bar: app mark, Zoom-style icon tabs, search, and settings/notification/profile placeholders. */
export default function TopNav() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const comingSoon = (what: string) => setToast(`${what} isn't part of this demo yet`);

  return (
    <header className="sticky top-0 z-40 border-b border-zoom-border bg-[#f7f8fa]">
      <div className="mx-auto flex h-[60px] items-center gap-3 px-3 sm:px-5">
        <Link href="/" className="flex items-center gap-2 pr-2" aria-label="Zoom Clone home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoom-blue text-white">
            <Video size={18} fill="currentColor" strokeWidth={1.5} />
          </span>
          <span className="hidden text-[17px] font-black tracking-tight text-zoom-text md:inline">Zoom Clone</span>
        </Link>

        <nav aria-label="Main" className="flex items-stretch">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
            const cls = `group flex w-[58px] sm:w-[72px] flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[11px] font-bold ${
              active ? "text-zoom-blue" : "text-zoom-muted hover:bg-black/[.04] hover:text-zoom-text"
            }`;
            const inner = (
              <>
                <Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
                <span className="truncate">{label}</span>
              </>
            );
            return href ? (
              <Link key={label} href={href} className={cls} aria-current={active ? "page" : undefined}>
                {inner}
              </Link>
            ) : (
              <button key={label} className={cls} onClick={() => comingSoon(label)}>
                {inner}
              </button>
            );
          })}
        </nav>

        <div className="mx-auto hidden max-w-[360px] flex-1 lg:block">
          <label className="flex h-8 items-center gap-2 rounded-lg border border-zoom-border bg-white px-3 text-sm text-zoom-muted focus-within:border-zoom-blue">
            <Search size={15} />
            <input
              placeholder="Search"
              className="w-full bg-transparent text-zoom-text outline-none placeholder:text-zoom-muted"
              onKeyDown={(e) => e.key === "Enter" && comingSoon("Search")}
            />
            <kbd className="hidden rounded border border-zoom-border px-1 text-[10px] xl:inline">Ctrl+F</kbd>
          </label>
        </div>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <button aria-label="Notifications" onClick={() => comingSoon("Notifications")} className="rounded-lg p-2 text-zoom-muted hover:bg-black/[.05] hover:text-zoom-text">
            <Bell size={19} />
          </button>
          <button aria-label="Settings" onClick={() => comingSoon("Settings")} className="rounded-lg p-2 text-zoom-muted hover:bg-black/[.05] hover:text-zoom-text">
            <Settings size={19} />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              aria-label="Profile"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="relative ml-1 rounded-lg"
            >
              <Avatar name={user?.name ?? "?"} size={32} />
              <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-[#f7f8fa] bg-zoom-green" />
            </button>
            {menuOpen && (
              <div className="animate-pop absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-zoom-border bg-white shadow-xl">
                <div className="flex items-center gap-3 border-b border-zoom-border p-4">
                  <Avatar name={user?.name ?? "?"} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-bold">{user?.name}</p>
                    <p className="truncate text-xs text-zoom-muted">{user?.email}</p>
                    <span className="mt-1 inline-block rounded bg-zoom-surface px-1.5 py-0.5 text-[11px] font-bold text-zoom-muted">Basic</span>
                  </div>
                </div>
                {["Available", "Settings", "Help", "Sign out"].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setMenuOpen(false);
                      comingSoon(item);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-zoom-surface"
                  >
                    {item === "Available" && <span className="h-2.5 w-2.5 rounded-full bg-zoom-green" />}
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div role="status" className="animate-pop fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-zoom-text px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </header>
  );
}
