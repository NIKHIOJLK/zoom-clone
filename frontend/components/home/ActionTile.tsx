import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  icon: LucideIcon;
  color: "orange" | "blue";
  onClick: () => void;
  disabled?: boolean;
  badge?: string; // e.g. the day-of-month on the Schedule calendar icon
};

/** The big rounded-square buttons on Zoom's Home screen. */
export default function ActionTile({ label, icon: Icon, color, onClick, disabled, badge }: Props) {
  const bg =
    color === "orange"
      ? "bg-zoom-orange hover:bg-zoom-orange-hover"
      : "bg-zoom-blue hover:bg-zoom-blue-hover";
  return (
    <button onClick={onClick} disabled={disabled} className="group flex flex-col items-center gap-2.5 disabled:opacity-60">
      <span
        className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-[22px] text-white shadow-[0_6px_16px_-6px_rgba(11,92,255,.45)] transition-transform group-active:scale-95 sm:h-[84px] sm:w-[84px] sm:rounded-[26px] ${bg}`}
      >
        <Icon size={34} strokeWidth={1.9} fill={color === "orange" ? "currentColor" : "none"} />
        {badge && (
          <span className="absolute top-[37px] text-[10px] font-black text-white sm:top-[43px]" aria-hidden>
            {badge}
          </span>
        )}
      </span>
      <span className="text-[13px] text-zoom-text">{label}</span>
    </button>
  );
}
