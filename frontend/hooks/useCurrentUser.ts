"use client";

import { useEffect, useState } from "react";
import { api, type User } from "@/lib/api";

// Cached for the life of the tab: the "logged-in" user never changes.
let cached: User | null = null;

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(cached);

  useEffect(() => {
    if (cached) return;
    api
      .me()
      .then((u) => {
        cached = u;
        setUser(u);
      })
      .catch(() => {
        /* the dashboard shows its own connection error */
      });
  }, []);

  return user;
}
