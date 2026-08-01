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

const NAV_TIMEOUT_MS = 60_000;
const XHR_SETTLE_MS = 8_000;

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

    await page.goto(DINING_PAGE, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
    await page.waitForTimeout(XHR_SETTLE_MS); // late XHRs

    if (captured === undefined) {
      throw new Error(
        "dining: no weekly-schedule response seen — Cloudflare may be blocking, or the page stopped calling apiv4",
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
