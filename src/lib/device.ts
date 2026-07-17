// Anonymous device identity (§3.1): a random UUID in localStorage, minted on
// first write. Not an account, not fingerprinting — it exists solely so the
// Edge Function can rate-limit and so a device's own updates could one day be
// shown back to it. Clearing site data legitimately resets it (the §5.5 IP
// limit is the backstop for that).

const KEY = "gritcheck:device-id";

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Private mode / storage disabled: a per-call id still satisfies the
    // payload shape; the server's IP limit does the real gating.
    return crypto.randomUUID();
  }
}
