// Validates scraper/seed/spots.json (Phase 0 exit criterion).
// Run: node scraper/seed/validate.ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seedFileSchema } from "./schema.ts";

const here = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(here, "spots.json"), "utf8"));

const result = seedFileSchema.safeParse(raw);
if (!result.success) {
  console.error("Seed file INVALID:");
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

// Cross-check: every dining source_slug must exist in the captured feed, so a
// renamed venue breaks here instead of silently never getting hours.
const feed = JSON.parse(
  readFileSync(join(here, "..", "fixtures", "dineoncampus-weekly-schedule.json"), "utf8")
);
const feedSlugs = new Set<string>(feed.theLocations.map((l: { slug: string }) => l.slug));
const missing = result.data.spots.filter(
  (s) => s.hours_source.kind === "dining" && !feedSlugs.has(s.hours_source.source_slug)
);
if (missing.length > 0) {
  console.error("source_slug not found in dining fixture:", missing.map((s) => s.slug).join(", "));
  process.exit(1);
}

const byCategory = result.data.spots.reduce<Record<string, number>>((acc, s) => {
  acc[s.category] = (acc[s.category] ?? 0) + 1;
  return acc;
}, {});
console.log(`Seed VALID — ${result.data.spots.length} spots`, byCategory);
console.log(`Status: ${result.data._meta.status}`);
