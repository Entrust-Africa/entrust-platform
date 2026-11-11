"use client";

import { useEffect, useState } from "react";
import type { UserProfile } from "./types";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** The signed-in person, for a client page that shows controls by role. Null until it has loaded, or when it can't. */
export function useMe(): UserProfile | null {
  const [me, setMe] = useState<UserProfile | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`${api}/v1/me`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<UserProfile>) : null))
      .then((profile) => {
        if (live) setMe(profile);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return me;
}
