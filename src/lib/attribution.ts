// Acquisition vs launch source (Alan, 2026-07-30). Two different questions
// that a single `source` field was silently conflating:
//
//   acquisition_src — how this person FIRST found GritCheck (dorm flyer, a QR
//                     code by the Commons line). Written once, never
//                     overwritten. This is the number that judges whether
//                     printing 200 flyers was worth it.
//   launch_src      — how THIS open started ("homescreen" for an installed
//                     launch, or the ?src= on the link they just tapped).
//
// The bug this fixes: the manifest's start_url is "/?src=homescreen", so once
// a student installed, every later open reported source=homescreen and their
// original flyer/QR attribution was overwritten — losing it for exactly the
// users who liked the product most.
//
// ⚠ iOS LIMIT, not a bug we can fix: adding to the home screen gives the app
// a storage container separate from Safari, so localStorage written during
// the Safari visit is NOT readable from the installed app. On iOS the
// pre-install acquisition source is structurally unrecoverable. We detect
// that case rather than silently mislabel it: a container whose very first
// open is a homescreen launch records "(pre-install)". The size of that
// bucket IS the measurement of what iOS costs us. Android/desktop share
// storage, so acquisition survives install there.

const ACQUISITION_KEY = "gritcheck:acquisition-src";

/** No ?src= on the URL — typed it, bookmark, or an untagged share. */
const DIRECT = "(direct)";
/** First open in this container was already an installed launch (see above). */
const PRE_INSTALL = "(pre-install)";
/** Sources that describe a launch mechanism, never an acquisition channel. */
const LAUNCH_ONLY = new Set(["homescreen"]);

function currentSrc(): string | null {
  return new URLSearchParams(window.location.search).get("src");
}

/** How this particular open started. Recomputed every time. */
export function launchSrc(): string {
  return currentSrc() ?? DIRECT;
}

/**
 * How this person first found GritCheck. Written on the first visit and never
 * overwritten — later opens read the stored value even when the current URL
 * carries a different `?src=`.
 */
export function acquisitionSrc(): string {
  try {
    const stored = localStorage.getItem(ACQUISITION_KEY);
    if (stored !== null) return stored;

    const raw = currentSrc();
    // A homescreen launch can never BE an acquisition channel; seeing it as
    // the first-ever open means we're in a fresh post-install container.
    const first = raw === null ? DIRECT : LAUNCH_ONLY.has(raw) ? PRE_INSTALL : raw;
    localStorage.setItem(ACQUISITION_KEY, first);
    return first;
  } catch {
    // Private mode / storage blocked: report the honest fallback rather than
    // inventing an attribution we can't persist.
    return DIRECT;
  }
}
