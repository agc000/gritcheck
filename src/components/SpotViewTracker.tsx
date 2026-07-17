"use client";

import { useEffect } from "react";

import { logEvent, msSinceOpen } from "@/lib/events";
import { recordFollowUpCandidate } from "@/lib/followup";

// Client shim for the SSR detail page. Viewing a spot detail (a) makes that
// spot the session's follow-up candidate (§4.2) and (b) logs view_spot with
// time-since-open — the §7.4 "reached a detail in <10 s" metric.
export function SpotViewTracker({
  id,
  slug,
  name,
}: {
  id: string;
  slug: string;
  name: string;
}) {
  useEffect(() => {
    recordFollowUpCandidate({ id, slug, name });
    const ms = msSinceOpen();
    logEvent("view_spot", { slug, ...(ms !== null && { ms_since_open: ms }) });
  }, [id, slug, name]);
  return null;
}
