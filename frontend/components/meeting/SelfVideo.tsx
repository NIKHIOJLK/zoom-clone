"use client";

import { useEffect, useRef } from "react";

/** Plays a MediaStream in a mirrored <video>, like Zoom's self view. */
export default function SelfVideo({ stream, className = "" }: { stream: MediaStream; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={`mirror h-full w-full object-cover ${className}`} />;
}
