"use client";

import { useSyncExternalStore } from "react";
import { rememberedName } from "@/lib/session";

// Values that only exist in the browser (clock, localStorage). useSyncExternalStore
// renders `null`/"" on the server and the real value on the client without a
// hydration mismatch and without setState-in-effect.

function subscribeEverySecond(onChange: () => void) {
  const t = setInterval(onChange, 1000);
  return () => clearInterval(t);
}

/** Current time in whole seconds (null during server render). Re-renders every second. */
export function useNowSeconds(): number | null {
  return useSyncExternalStore(
    subscribeEverySecond,
    () => Math.floor(Date.now() / 1000),
    () => null,
  );
}

const noSubscribe = () => () => {};

/** The name saved with "Remember my name" ("" on the server). */
export function useRememberedName(): string {
  return useSyncExternalStore(noSubscribe, rememberedName, () => "");
}
