"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientEvent } from "./useMeetingSocket";

/** What travels inside a "signal" message: an SDP offer/answer or an ICE candidate. */
export type SignalData = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

// STUN tells each browser its public address. TURN (optional) relays media when a direct
// connection is impossible, e.g. behind strict corporate or mobile networks.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.NEXT_PUBLIC_TURN_URL.split(","),
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        },
      ]
    : []),
];

type Peer = {
  pc: RTCPeerConnection;
  polite: boolean; // on an offer collision the polite side backs off (MDN "perfect negotiation")
  makingOffer: boolean;
  ignoreOffer: boolean;
  queue: Promise<void>; // signals for one peer are handled strictly in order
  senders: { audio: RTCRtpSender | null; video: RTCRtpSender | null };
  remote: MediaStream;
};

type Options = {
  myId: number;
  peerIds: number[]; // other participants whose socket is connected
  send: (msg: ClientEvent) => void;
  audioTrack: MediaStreamTrack | null;
  videoTrack: MediaStreamTrack | null; // camera, or the screen while sharing
};

/**
 * Mesh WebRTC: one RTCPeerConnection to every other participant. Media flows browser to
 * browser; the server only relays the signaling messages over the meeting socket.
 * Fine for small meetings (2–4 people); larger rooms would need an SFU.
 */
export function usePeers({ myId, peerIds, send, audioTrack, videoTrack }: Options) {
  const peers = useRef(new Map<number, Peer>());
  const [streams, setStreams] = useState<Record<number, MediaStream>>({});
  const latest = useRef({ send, audioTrack, videoTrack });
  useEffect(() => {
    latest.current = { send, audioTrack, videoTrack };
  });

  const publish = useCallback((peerId: number, peer: Peer) => {
    // a new MediaStream object so React re-renders the tile
    setStreams((s) => ({ ...s, [peerId]: new MediaStream(peer.remote.getTracks()) }));
  }, []);

  /** Send our current tracks: replace in place when possible (no renegotiation needed). */
  const syncTracks = useCallback((peer: Peer) => {
    const tracks = { audio: latest.current.audioTrack, video: latest.current.videoTrack };
    for (const kind of ["audio", "video"] as const) {
      const sender = peer.senders[kind];
      const track = tracks[kind];
      if (sender) {
        if (sender.track !== track) sender.replaceTrack(track).catch(() => {});
      } else if (track) {
        peer.senders[kind] = peer.pc.addTrack(track); // triggers negotiationneeded
      }
    }
  }, []);

  const createPeer = useCallback(
    (peerId: number) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const peer: Peer = {
        pc,
        polite: myId > peerId,
        makingOffer: false,
        ignoreOffer: false,
        queue: Promise.resolve(),
        senders: { audio: null, video: null },
        remote: new MediaStream(),
      };
      const signal = (data: SignalData) => latest.current.send({ type: "signal", to: peerId, data });

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) signal({ candidate: candidate.toJSON() });
      };
      pc.onnegotiationneeded = async () => {
        try {
          peer.makingOffer = true;
          await pc.setLocalDescription(); // creates the offer
          if (pc.localDescription) signal({ description: pc.localDescription.toJSON() });
        } catch {
          /* superseded by a newer negotiation */
        } finally {
          peer.makingOffer = false;
        }
      };
      pc.ontrack = ({ track }) => {
        peer.remote.getTracks().filter((t) => t.kind === track.kind).forEach((t) => peer.remote.removeTrack(t));
        peer.remote.addTrack(track);
        // camera off on the other side -> no frames -> "mute"; re-render to show the avatar
        track.onmute = track.onunmute = () => publish(peerId, peer);
        publish(peerId, peer);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") pc.restartIce();
      };

      peers.current.set(peerId, peer);
      syncTracks(peer);
      return peer;
    },
    [myId, publish, syncTracks],
  );

  const closePeer = useCallback((peerId: number) => {
    const peer = peers.current.get(peerId);
    if (!peer) return;
    peer.pc.close();
    peers.current.delete(peerId);
    setStreams((s) => {
      const next = { ...s };
      delete next[peerId];
      return next;
    });
  }, []);

  /** Handle an offer, answer or ICE candidate relayed from another participant. */
  const handleSignal = useCallback(
    (from: number, data: SignalData) => {
      const peer = peers.current.get(from) ?? createPeer(from);
      peer.queue = peer.queue.then(async () => {
        const { pc } = peer;
        try {
          if (data.description) {
            const collision = data.description.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
            peer.ignoreOffer = !peer.polite && collision;
            if (peer.ignoreOffer) return;
            await pc.setRemoteDescription(data.description); // a polite peer rolls back its own offer here
            if (data.description.type === "offer") {
              await pc.setLocalDescription(); // creates the answer
              if (pc.localDescription) latest.current.send({ type: "signal", to: from, data: { description: pc.localDescription.toJSON() } });
            }
          } else if (data.candidate) {
            try {
              await pc.addIceCandidate(data.candidate);
            } catch (err) {
              if (!peer.ignoreOffer) throw err;
            }
          }
        } catch {
          /* a broken negotiation recovers on the next offer or ICE restart */
        }
      });
    },
    [createPeer],
  );

  // connect to new peers, drop the ones who left
  const peerKey = [...peerIds].sort((a, b) => a - b).join(",");
  useEffect(() => {
    const wanted = new Set(peerKey ? peerKey.split(",").map(Number) : []);
    for (const id of wanted) if (!peers.current.has(id)) createPeer(id);
    for (const id of [...peers.current.keys()]) if (!wanted.has(id)) closePeer(id);
  }, [peerKey, createPeer, closePeer]);

  // mic / camera / screen changed: update what every peer receives
  useEffect(() => {
    peers.current.forEach(syncTracks);
  }, [audioTrack, videoTrack, syncTracks]);

  // hang up everything when leaving the room
  useEffect(() => {
    const map = peers.current;
    return () => {
      map.forEach((p) => p.pc.close());
      map.clear();
    };
  }, []);

  return { streams, handleSignal };
}
