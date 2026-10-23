"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL, type ChatMessage, type Participant } from "@/lib/api";
import type { SignalData } from "./usePeers";

/** Events the server pushes over the meeting socket (see backend/app/realtime.py). */
export type ServerEvent =
  | { type: "participants"; participants: Participant[]; online: number[] }
  | { type: "message"; message: ChatMessage }
  | { type: "removed" }
  | { type: "ended" }
  | { type: "signal"; from: number; data: SignalData }
  | { type: "rejected" }; // local only: the server refused the socket (meeting over or not a member)

export type ClientEvent = { type: "signal"; to: number; data: SignalData } | { type: "ping" };

/**
 * One WebSocket per participant. Reconnects with backoff (1s, 2s, 4s… up to 10s) and
 * sends a ping every 25s so proxies don't close an idle connection.
 */
export function useMeetingSocket(
  code: string,
  me: { participantId: number; participantToken: string } | null,
  onEvent: (e: ServerEvent) => void,
) {
  const participantId = me?.participantId ?? null;
  const token = me?.participantToken ?? "";
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handler = useRef(onEvent);

  // always call the latest handler without reconnecting when it changes
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    if (participantId === null) return;
    let stopped = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const open = () => {
      const url = `${WS_URL}/ws/meetings/${code}?participant_id=${participantId}&token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (e) => {
        try {
          handler.current(JSON.parse(e.data) as ServerEvent);
        } catch {
          /* ignore malformed messages */
        }
      };
      ws.onclose = (e) => {
        if (wsRef.current === ws) wsRef.current = null;
        setConnected(false);
        if (stopped) return;
        // 4404: meeting over or I was removed; 4401: my participant token isn't valid
        if (e.code === 4404 || e.code === 4401) return handler.current({ type: "rejected" });
        if (e.code === 4000) return; // replaced by a newer socket for the same participant
        retryTimer = setTimeout(open, Math.min(1000 * 2 ** attempt++, 10_000));
      };
    };

    open();
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "ping" }));
    }, 25_000);

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearInterval(ping);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [code, participantId, token]);

  const send = useCallback((msg: ClientEvent) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  return { connected, send };
}
