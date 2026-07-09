// Loads scraper/seed/spots.json into the `spots` table (BUILD_PLAN Phase 1).
// Run: node --env-file=.env.local scraper/seed/load.ts
//
// Uses the SERVICE ROLE key: there is no anon insert policy on `spots` (§3.5),
// so only the service role (RLS-bypassing) can seed. This runs from a trusted
// machine/CI, never the browser. Idempotent: upserts on `slug`, so re-running
// updates rows in place instead of duplicating them.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { seedFileSchema } from "./schema.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set them in .env.local).",
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(here, "spots.json"), "utf8"));

// Validate before touching the DB — a bad seed file should fail here, not halfway
// through an upsert. Reuses the same schema the Phase 0 validator uses.
const parsed = seedFileSchema.safeParse(raw);
if (!parsed.success) {
  console.error("Seed file INVALID — aborting:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

// Map to `spots` columns explicitly. hours_source is scraper metadata, not a
// column (§3.1), so it is deliberately not carried over. active/frozen keep
// their DB defaults.
const rows = parsed.data.spots.map((s) => ({
  slug: s.slug,
  name: s.name,
  category: s.category,
  building: s.building,
  lat: s.lat,
  lng: s.lng,
  attributes: s.attributes,
  consensus: s.consensus,
  baseline: s.baseline,
}));

const supabase = createClient(url, serviceKey);
const { error } = await supabase.from("spots").upsert(rows, { onConflict: "slug" });
if (error) {
  console.error("Upsert failed:", error.message);
  process.exit(1);
}

console.log(`Seeded ${rows.length} spots (${parsed.data._meta.status.split(" —")[0]}).`);
