"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

// §5.4: Realtime subscription on `updates` triggers a refetch. The refetch is
// router.refresh() — the page is force-dynamic, so the server re-reads the
// aggregation view and every consumer (rows, glow, detail) repaints from one
// source of truth. At 22 spots the full re-render is cheaper than plumbing
// per-spot patching through three trees.
//
// Perf posture (Phase 3 carryover): the websocket connect is idle-gated like
// the map mount, so it never contends with hydration on the critical path.
const IDLE_TIMEOUT_MS = 4_000;
const SAFARI_FALLBACK_MS = 1_500;
// Bursts of inserts (two friends reporting at once) collapse into one refetch.
const DEBOUNCE_MS = 400;

export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const start = () => {
      channel = supabase
        .channel("updates-live")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "updates" },
          () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => router.refresh(), DEBOUNCE_MS);
          },
        )
        .subscribe();
    };

    const idleId =
      "requestIdleCallback" in window
        ? requestIdleCallback(start, { timeout: IDLE_TIMEOUT_MS })
        : setTimeout(start, SAFARI_FALLBACK_MS);

    return () => {
      if ("requestIdleCallback" in window) {
        cancelIdleCallback(idleId as number);
      } else {
        clearTimeout(idleId as ReturnType<typeof setTimeout>);
      }
      if (debounce) clearTimeout(debounce);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
