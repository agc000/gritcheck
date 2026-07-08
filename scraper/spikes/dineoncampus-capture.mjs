// Phase 0 spike: can plain headless Chromium load dineoncampus and capture its API JSON?
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const captured = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
});

page.on("response", async (res) => {
  const url = res.url();
  if (url.includes("api.dineoncampus") || (url.includes("dineoncampus") && res.headers()["content-type"]?.includes("json"))) {
    try {
      const body = await res.text();
      captured.push({ url, status: res.status(), body });
      console.log("CAPTURED", res.status(), url.slice(0, 140));
    } catch {}
  }
});

try {
  await page.goto("https://dineoncampus.com/UMBC/hours-of-operation", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
} catch (e) {
  console.log("goto:", e.message.split("\n")[0]);
}
console.log("TITLE:", await page.title());
await page.waitForTimeout(8000); // let late XHRs land
console.log("TITLE after wait:", await page.title());
const text = (await page.textContent("body"))?.replace(/\s+/g, " ").slice(0, 400);
console.log("BODY:", text);

writeFileSync(
  "/private/tmp/claude-501/-Users-ac-Developer-gritcheck/e5d1a31e-3bcb-440c-9083-2de1c86c118c/scratchpad/dineoncampus-captures.json",
  JSON.stringify(captured, null, 2)
);
console.log("captured", captured.length, "API responses");
await browser.close();
