"use client";

import { format } from "date-fns";
import { SendHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Avatar from "../Avatar";
import type { ChatMessage } from "@/lib/api";

type Props = {
  messages: ChatMessage[];
  meId: number;
  onSend: (text: string) => Promise<void>;
  onClose: () => void;
};

/** In-meeting chat to everyone. Messages are stored in the DB and polled by the room. */
export default function ChatPanel({ messages, meId, onSend, onClose }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await onSend(value);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <aside aria-label="Chat" className="flex h-full w-full flex-col bg-white text-zoom-text">
      <div className="flex items-center justify-between border-b border-zoom-border px-4 py-3">
        <h2 className="text-sm font-bold">Meeting chat</h2>
        <button onClick={onClose} aria-label="Close chat" className="rounded p-1 text-zoom-muted hover:bg-zoom-surface">
          <X size={18} />
        </button>
      </div>

      <div className="thin-scroll flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-zoom-muted">Messages you send here go to everyone in the meeting.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2.5">
            <Avatar name={m.sender_name} size={28} />
            <div className="min-w-0">
              <p className="text-xs text-zoom-muted">
                <span className="font-bold text-zoom-text">{m.participant_id === meId ? "Me" : m.sender_name}</span>{" "}
                {format(new Date(m.created_at), "h:mm a")}
              </p>
              <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-zoom-border p-3">
        <p className="mb-1.5 text-xs text-zoom-muted">
          To: <span className="rounded bg-zoom-blue-soft px-1.5 py-0.5 font-bold text-zoom-blue">Everyone</span>
        </p>
        <div className="flex items-end gap-2 rounded-lg border border-zoom-border px-3 py-2 focus-within:border-zoom-blue">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            rows={2}
            maxLength={1000}
            placeholder="Message everyone"
            className="flex-1 resize-none text-sm outline-none"
          />
          <button disabled={!text.trim() || sending} aria-label="Send message" className="rounded p-1 text-zoom-blue disabled:text-zoom-border">
            <SendHorizontal size={18} />
          </button>
        </div>
      </form>
    </aside>
  );
}
