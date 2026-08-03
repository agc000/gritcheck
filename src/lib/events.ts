import { supabase } from "./supabase";
import { acquisitionSrc, launchSrc } from "./attribution";
import { getDeviceId } from "./device";
import { isStandalone } from "./install";

// §3.1 events: product analytics, write-only from the client (anon INSERT
// policy + grant). Names are the §3.1 vocabulary; §7.4 reads them weekly.
// Fire-and-forget by design — analytics must never surface an error or add
// latency to a user action.
export type EventName =
  | "open_app"
  | "view_spot"
  | "submit_update"
  | "followup_shown"
  | "followup_answered"
  | "install_shown"
  | "install_answered"
  | "client_error";

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
  // `standalone` separates an installed home-screen launch from a browser
  // visit — otherwise the two are indistinguishable in the data, and launch
  // week needs the install funnel to be readable end to end:
  // install_shown → install_answered → standalone open_app.
  // Note (iOS): installing mints a NEW device_id, because iOS gives
  // home-screen apps their own storage container. An installed user is a
  // fresh device here by design of the platform, not by ours.
  //
  // Two source fields, deliberately (see lib/attribution.ts): acquisition is
  // sticky and answers "did the flyers work"; launch is per-open and answers
  // "how did they get in this time". One field could not do both — the
  // homescreen start_url was overwriting acquisition for installed users.
  logEvent("open_app", {
    standalone: isStandalone(),
    acquisition_src: acquisitionSrc(),
    launch_src: launchSrc(),
  });
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
