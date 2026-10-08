import { avatarColor, initials } from "@/lib/format";

type Props = { name: string; size?: number; className?: string; rounded?: "full" | "lg" };

export default function Avatar({ name, size = 32, className = "", rounded = "lg" }: Props) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center font-bold text-white select-none ${
        rounded === "full" ? "rounded-full" : "rounded-lg"
      } ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4, background: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  );
}
