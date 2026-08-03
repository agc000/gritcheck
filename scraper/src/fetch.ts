// Network access for both feeds. Kept apart from parse.ts so the parsers stay
// pure and testable offline (see the header there).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "fixtures");

const DINING_PAGE = "https://dineoncampus.com/UMBC/hours-of-operation";
// iid 991 = UMBC. weeks=2 is what the endpoint returns anyway; asking is explicit.
const LIBCAL_URL = "https://api3.libcal.com/api_hours_grid.php?iid=991&format=json&weeks=2";

const NAV_TIMEOUT_MS = 45_000;
// How long to keep waiting for the weekly-schedule XHR after navigation settles
// (or gives up). Cloudflare's interstitial can add 5–15s before the real page
// even starts loading, so this is generous on purpose.
const CAPTURE_TIMEOUT_MS = 45_000;
const CAPTURE_POLL_MS = 500;

/**
 * Dining needs a real browser: Cloudflare TLS-fingerprints plain fetches and
 * 403s them, while headless Chromium passes clean (proven in
 * scraper/spikes/dineoncampus-capture.mjs). We do not scrape the rendered DOM —
 * we let the page call its own API and intercept the JSON, which is a far more
 * stable contract than markup.
 *
 * Playwright is imported dynamically so fixture mode needs no browser at all.
 */
export async function fetchDining(): Promise<unknown> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    });

    let captured: unknown;
    page.on("response", async (res) => {
      if (captured !== undefined) return;
      const url = res.url();
      if (!url.includes("dineoncampus")) return;
      if (!res.headers()["content-type"]?.includes("json")) return;
      try {
        const body = JSON.parse(await res.text());
        // Identify the response by its SHAPE rather than its URL: the API host
        // and path have moved before, the weekly-schedule payload has not.
        if (body && typeof body === "object" && Array.isArray(body.theLocations)) {
          captured = body;
        }
      } catch {
        // Not JSON we can use; keep listening.
      }
    });

    // SUCCESS IS THE CAPTURE, NOT THE NAVIGATION. `networkidle` is unreliable
    // on pages that poll or beacon, and the Cloudflare interstitial refreshes
    // itself — so waiting for the page to go quiet can time out long after the
    // payload we wanted already arrived. The Phase 0 spike tolerated a failed
    // goto and checked its captures anyway; this restores that, which a
    // tidier-looking rewrite had silently dropped.
    let navError: string | undefined;
    try {
      await page.goto(DINING_PAGE, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
    } catch (err) {
      navError = err instanceof Error ? err.message.split("\n")[0] : String(err);
    }

    const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
    while (captured === undefined && Date.now() < deadline) {
      await page.waitForTimeout(CAPTURE_POLL_MS);
    }

    if (captured === undefined) {
      // Diagnostics matter here: "blocked by Cloudflare" and "the page stopped
      // calling apiv4" need completely different fixes, and the title tells
      // them apart ("Just a moment..." is the challenge).
      const title = await page.title().catch(() => "(unavailable)");
      const url = page.url();
      throw new Error(
        `dining: no weekly-schedule response captured.\n` +
          `  page title: ${title}\n` +
          `  landed on:  ${url}\n` +
          (navError ? `  navigation: ${navError}\n` : "") +
          `  A "Just a moment..." title means Cloudflare blocked this runner; ` +
          `anything else means the page stopped calling apiv4.`,
      );
    }
    return captured;
  } finally {
    await browser.close();
  }
}

/** LibCal publishes open JSON; no browser, no key. */
export async function fetchLibCal(): Promise<unknown> {
  const res = await fetch(LIBCAL_URL, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`libcal: HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Offline sources for --fixtures runs and tests. */
export function readDiningFixture(): unknown {
  return JSON.parse(readFileSync(join(fixtures, "dineoncampus-weekly-schedule.json"), "utf8"));
}

export function readLibcalFixture(): unknown {
  return JSON.parse(readFileSync(join(fixtures, "libcal-hours-grid.json"), "utf8"));
}
