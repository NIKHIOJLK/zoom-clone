import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean; // highlighted (panel open)
  danger?: boolean; // red icon (muted / video off)
  badge?: number | string;
  className?: string;
  ariaLabel?: string;
};

/** Icon-over-label button used in the meeting toolbar. */
export default function ToolbarButton({ icon: Icon, label, onClick, active, danger, badge, className = "", ariaLabel }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      aria-pressed={active}
      className={`relative flex min-w-[58px] flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-[#e6e6e6] hover:bg-room-hover sm:min-w-[72px] ${
        active ? "bg-room-hover" : ""
      } ${className}`}
    >
      <span className="relative">
        <Icon size={22} strokeWidth={1.8} className={danger ? "text-[#ff4d4f]" : ""} />
        {badge !== undefined && badge !== 0 && (
          <span className="absolute -top-1.5 -right-3 min-w-[18px] rounded-full bg-room-tile px-1 text-center text-[10px] leading-[16px] font-bold text-white ring-1 ring-room-border">
            {badge}
          </span>
        )}
      </span>
      <span className="hidden whitespace-nowrap sm:block">{label}</span>
    </button>
  );
}
