"use client";

import { MicOff } from "lucide-react";
import { useEffect, useRef } from "react";
import Avatar from "../Avatar";
import SelfVideo from "./SelfVideo";

type Props = {
  name: string;
  isHost: boolean;
  isMe: boolean;
  muted: boolean;
  stream?: MediaStream | null; // my own camera (mirrored, silent)
  remoteStream?: MediaStream | null; // another participant's audio + video from WebRTC
  reaction?: string | null;
};

/** One gallery tile: video (mine or a peer's) or avatar, name label bottom-left, mute icon. */
export default function VideoTile({ name, isHost, isMe, muted, stream, remoteStream, reaction }: Props) {
  // the peer's video is shown only while frames are arriving (their camera is on)
  const remoteVideo = remoteStream?.getVideoTracks().find((t) => t.readyState === "live" && !t.muted);

  return (
    <div className="relative flex aspect-video min-h-0 w-full items-center justify-center overflow-hidden rounded-lg bg-room-tile">
      {stream ? (
        <SelfVideo stream={stream} />
      ) : remoteStream && remoteVideo ? (
        <RemoteVideo stream={remoteStream} />
      ) : (
        <Avatar name={name} size={72} className="!rounded-2xl text-2xl" />
      )}
      {remoteStream && <RemoteAudio stream={remoteStream} />}

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

/** A peer's camera or screen. Muted here; their sound plays through RemoteAudio. */
function RemoteVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted data-remote-video className="h-full w-full bg-black object-contain" />;
}

/** Plays a peer's microphone. Kept separate so audio continues when their camera is off. */
function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}
