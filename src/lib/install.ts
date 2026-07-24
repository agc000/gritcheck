// Install-prompt bookkeeping (§Phase 5): offer "add to home screen" from the
// second distinct visit on, never inside the installed app, and snooze on any
// dismissal — the §5.5 proportionality principle applied to our own nagging.
// All storage access is wrapped: private mode must never throw, and a device
// without storage simply never sees the prompt (it also can't be rate-limited
// into seeing it once).

const VISITS_KEY = "gritcheck:visits";
const COUNTED_KEY = "gritcheck:visit-counted"; // sessionStorage: once/session
const SNOOZED_AT_KEY = "gritcheck:install-snoozed-at";
const INSTALLED_KEY = "gritcheck:installed";

// Second visit = someone who came back; first visit is too eager (§7.3 wants
// installs from people already in the loop). Snooze is two weeks: long enough
// to not nag, short enough that orientation-week holdouts get one more look.
export const MIN_VISITS_TO_OFFER = 2;
export const INSTALL_SNOOZE_MS = 14 * 24 * 60 * 60_000;

/** Counts this session as a visit (once) and returns the running total. */
export function countVisit(): number {
  try {
    const total = Number(localStorage.getItem(VISITS_KEY)) || 0;
    if (sessionStorage.getItem(COUNTED_KEY)) return total;
    sessionStorage.setItem(COUNTED_KEY, "1");
    localStorage.setItem(VISITS_KEY, String(total + 1));
    return total + 1;
  } catch {
    return 0;
  }
}

/** True inside an installed PWA (standalone display or iOS home-screen). */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function shouldOfferInstall(): boolean {
  if (isStandalone()) return false;
  try {
    if (localStorage.getItem(INSTALLED_KEY)) return false;
    const snoozedAt = Number(localStorage.getItem(SNOOZED_AT_KEY)) || 0;
    if (Date.now() - snoozedAt < INSTALL_SNOOZE_MS) return false;
    return (Number(localStorage.getItem(VISITS_KEY)) || 0) >= MIN_VISITS_TO_OFFER;
  } catch {
    return false;
  }
}

export function snoozeInstall() {
  try {
    localStorage.setItem(SNOOZED_AT_KEY, String(Date.now()));
  } catch {
    // Nothing to do — without storage the prompt is never offered anyway.
  }
}

export function markInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    // Ditto.
  }
}
