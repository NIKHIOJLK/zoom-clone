"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Camera + microphone for the self-view.
 * Turning video off stops the camera track (so the camera light goes off);
 * turning it back on asks for a fresh track. Muting just disables the audio track.
 */
export function useLocalMedia(initial: { videoOn: boolean; micOn: boolean }) {
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [videoOn, setVideoOn] = useState(initial.videoOn);
  const [micOn, setMicOn] = useState(initial.micOn);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<MediaStream | null>(null);

  // camera: request a stream while video is on, stop it when turned off or unmounted
  useEffect(() => {
    if (!videoOn) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    const request = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
      : Promise.reject(new Error("unsupported"));

    request
      .then((s) => {
        stream = s;
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        setVideoStream(s);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Camera unavailable. Allow camera access in your browser to turn on video.");
        setVideoOn(false);
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoOn]);

  // microphone: opened once, then enabled/disabled by mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.getAudioTracks().forEach((t) => (t.enabled = micOn));
      return;
    }
    if (!micOn || !navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        audioRef.current = s;
      })
      .catch(() => {
        /* no mic: we still show the mute state in the UI */
      });
  }, [micOn]);

  // release the microphone when leaving the page
  useEffect(() => () => audioRef.current?.getTracks().forEach((t) => t.stop()), []);

  return {
    videoStream: videoOn ? videoStream : null,
    videoOn,
    setVideoOn,
    micOn,
    setMicOn,
    error,
  };
}
