import { supabase } from "./supabase";
import { getDeviceId } from "./device";

// §3.1 events: product analytics, write-only from the client (anon INSERT
// policy + grant). Names are the §3.1 vocabulary; §7.4 reads them weekly.
// Fire-and-forget by design — analytics must never surface an error or add
// latency to a user action.
export type EventName =
  | "open_app"
  | "view_spot"
  | "submit_update"
  | "followup_shown"
  | "followup_answered";

// Session-open timestamp: §7.4 wants "% of sessions reaching a spot detail
// in <10 s", so view_spot events carry ms_since_open.
const OPENED_KEY = "gritcheck:opened-at";

/** Logs open_app once per session; returns silently on later calls. */
export function markAppOpen() {
  try {
    if (sessionStorage.getItem(OPENED_KEY)) return;
    sessionStorage.setItem(OPENED_KEY, String(Date.now()));
  } catch {
    // Private mode: still log the open, just without session dedupe/timing.
  }
  const src = new URLSearchParams(window.location.search).get("src");
  logEvent("open_app", src ? { source: src } : {});
}

export function msSinceOpen(): number | null {
  try {
    const t = sessionStorage.getItem(OPENED_KEY);
    return t ? Date.now() - Number(t) : null;
  } catch {
    return null;
  }
}

export function logEvent(
  name: EventName,
  props: Record<string, string | number | boolean> = {},
) {
  void supabase
    .from("events")
    .insert({ device_id: getDeviceId(), name, props })
    .then(({ error }) => {
      if (error && process.env.NODE_ENV !== "production") {
        console.warn(`event ${name} not recorded:`, error.message);
      }
    });
}
