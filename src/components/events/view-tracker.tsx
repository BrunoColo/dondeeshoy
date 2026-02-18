"use client";

import { useEffect } from "react";

export function ViewTracker({ eventId }: { eventId: string }) {
  useEffect(() => {
    // Dedup: count at most 1 view per event per browser session
    const storageKey = `viewed:${eventId}`;
    if (sessionStorage.getItem(storageKey)) {
      return;
    }

    sessionStorage.setItem(storageKey, "1");

    // Fire-and-forget view tracking
    fetch("/api/events/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    }).catch(() => {
      // Silently ignore errors — view tracking is non-critical
    });
  }, [eventId]);

  return null;
}
