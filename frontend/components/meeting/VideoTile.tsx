"use client";

import { MicOff } from "lucide-react";
import Avatar from "../Avatar";
import SelfVideo from "./SelfVideo";

type Props = {
  name: string;
  isHost: boolean;
  isMe: boolean;
  muted: boolean;
  stream?: MediaStream | null; // only for my own tile
  reaction?: string | null;
};

/** One gallery tile: video (for me) or avatar, name label bottom-left, mute icon. */
export default function VideoTile({ name, isHost, isMe, muted, stream, reaction }: Props) {
  return (
    <div className="relative flex aspect-video min-h-0 w-full items-center justify-center overflow-hidden rounded-lg bg-room-tile">
      {stream ? (
        <SelfVideo stream={stream} />
      ) : (
        <Avatar name={name} size={72} className="!rounded-2xl text-2xl" />
      )}

      {reaction && (
        <span aria-label="reaction" className="animate-pop absolute top-3 left-3 text-4xl drop-shadow">
          {reaction}
        </span>
      )}

      <span className="absolute bottom-2 left-2 flex max-w-[85%] items-center gap-1.5 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {muted && <MicOff size={13} className="shrink-0 text-[#ff4d4f]" aria-label="muted" />}
        <span className="truncate">
          {name}
          {isMe && " (me)"}
        </span>
        {isHost && <span className="shrink-0 text-room-muted">· Host</span>}
      </span>
    </div>
  );
}
