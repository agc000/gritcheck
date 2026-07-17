"use client";

import { useEffect } from "react";

import { markAppOpen } from "@/lib/events";

// Lives in the root layout: any entry URL (map or a deep-linked spot page)
// counts as opening the app. ?src= survives into the event for the §7.4
// QR-source metric.
export function OpenTracker() {
  useEffect(() => {
    markAppOpen();
  }, []);
  return null;
}
