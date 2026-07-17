// Follow-up prompt bookkeeping (§4.2): if the user viewed a Best bet or a
// spot detail and ~10 min elapse (re-open / visibility change), ask once —
// "Did X pan out?" — and never again that session. sessionStorage is the
// right scope: the cap is per session, and a fresh tab legitimately starts
// clean. All reads/writes are wrapped — private mode must never throw.

const CANDIDATE_KEY = "gritcheck:followup-candidate";
const SHOWN_KEY = "gritcheck:followup-shown";

// ~10 min (§4.2). Logged as a constant, not a magic number (§5.3 spirit).
export const FOLLOWUP_AFTER_MS = 10 * 60_000;

export type FollowUpCandidate = {
  id: string;
  slug: string;
  name: string;
  at: number;
};

export function recordFollowUpCandidate(c: Omit<FollowUpCandidate, "at">) {
  try {
    if (sessionStorage.getItem(SHOWN_KEY)) return;
    const prev = readCandidate();
    // Re-viewing the same spot keeps the ORIGINAL timestamp — otherwise a
    // user who keeps checking the row would reset the clock and never get
    // asked. A different spot replaces the candidate (most recent interest
    // wins).
    if (prev?.slug === c.slug) return;
    sessionStorage.setItem(
      CANDIDATE_KEY,
      JSON.stringify({ ...c, at: Date.now() }),
    );
  } catch {
    // Storage unavailable → the feature silently doesn't exist. Fine.
  }
}

function readCandidate(): FollowUpCandidate | null {
  try {
    const raw = sessionStorage.getItem(CANDIDATE_KEY);
    return raw ? (JSON.parse(raw) as FollowUpCandidate) : null;
  } catch {
    return null;
  }
}

/** The candidate to prompt about right now, or null. Marks the session's
 *  one prompt as used — callers must actually show it. */
export function takeFollowUpPrompt(): FollowUpCandidate | null {
  try {
    if (sessionStorage.getItem(SHOWN_KEY)) return null;
    const c = readCandidate();
    if (!c || Date.now() - c.at < FOLLOWUP_AFTER_MS) return null;
    sessionStorage.setItem(SHOWN_KEY, "1");
    sessionStorage.removeItem(CANDIDATE_KEY);
    return c;
  } catch {
    return null;
  }
}
