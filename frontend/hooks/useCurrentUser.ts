"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type User } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

// Cached for the life of the tab so every component doesn't refetch it.
let cached: User | null = null;

/** Forget the cached user (after signing in, signing up or signing out). */
export function resetCurrentUser(user: User | null = null) {
  cached = user;
}

/** The signed-in account, or null for a guest (no token) while loading. */
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(cached);

  useEffect(() => {
    if (cached || !getToken()) return;
    api
      .me()
      .then((u) => {
        cached = u;
        setUser(u);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) clearToken(); // expired: continue as a guest
      });
  }, []);

  return user;
}
