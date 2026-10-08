"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
};

/** Zoom-style dialog: white card, title bar with close button, optional footer row. */
export default function Modal({ title, onClose, children, footer, width = 440 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // focus the first input for keyboard users
    ref.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-pop flex max-h-[92vh] w-full flex-col rounded-xl bg-white shadow-2xl"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between border-b border-zoom-border px-5 py-3.5">
          <h2 className="text-[15px] font-bold text-zoom-text">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-md p-1 text-zoom-muted hover:bg-zoom-surface hover:text-zoom-text"
          >
            <X size={18} />
          </button>
        </div>
        <div className="thin-scroll overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-zoom-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Buttons used across dialogs, matching Zoom's rounded blue primary / grey secondary. */
export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`rounded-lg bg-zoom-blue px-4 py-2 text-sm font-bold text-white hover:bg-zoom-blue-hover disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`rounded-lg border border-zoom-border bg-white px-4 py-2 text-sm font-bold text-zoom-text hover:bg-zoom-surface disabled:opacity-50 ${className}`}
    />
  );
}
