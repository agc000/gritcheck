// Paused mode (2026-11-18): one switch that turns live reporting off without
// deleting anything. Every write affordance (Update FAB, "How's it right
// now?", follow-up bar) and the recent-comments list check this; the map,
// hours, baselines and spot info keep working. The submit-update Edge
// Function has its own PAUSED secret so stale cached clients and direct POSTs
// are refused server-side too.
//
// Server-only on purpose (no NEXT_PUBLIC_ prefix): pages read it per request
// and pass booleans down, so the flag never gets baked into the client bundle.
// Flip it in Vercel → Environment Variables and redeploy; unset to resume.
export function isPaused(): boolean {
  return process.env.PAUSED === "true";
}

export const PAUSED_MESSAGE =
  "GritCheck is paused. Live reports are off as they cannot be moderated at the moment. Map and spot info still work, and hours will be updated shortly.";
