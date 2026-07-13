// Loads scraper/seed/hours.json into `spot_hours`, source-tagged
// 'manual-provisional' (docs/HOURS_BASELINES-1.md): distinct from 'manual' so
// the Phase 6 scraper knows these rows are placeholders it SHOULD replace,
// while true 'manual' overrides win. Run:
//   node --env-file=.env.local scraper/seed/load-hours.ts
//
// Idempotent: deletes previous manual-provisional rows, then inserts fresh —
// re-running converges instead of duplicating. Multi-period days (True
// Grit's) are just multiple rows per (spot, day); closes <= opens crosses
// midnight (§3.1).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SOURCE = "manual-provisional";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set them in .env.local).",
  );
  process.exit(1);
}

const hoursFileSchema = z.object({
  _meta: z.object({ source: z.string(), note: z.string() }),
  hours: z.array(
    z.object({
      slug: z.string(),
      day_of_week: z.number().int().min(0).max(6),
      opens: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      closes: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    }),
  ),
});

const here = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(here, "hours.json"), "utf8"));
const parsed = hoursFileSchema.safeParse(raw);
if (!parsed.success) {
  console.error("hours.json INVALID — aborting:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

// Resolve slugs → spot ids; unknown slugs abort before any write.
const { data: spots, error: spotsError } = await supabase
  .from("spots")
  .select("id,slug");
if (spotsError || !spots) {
  console.error("Failed to read spots:", spotsError?.message);
  process.exit(1);
}
const idBySlug = new Map(spots.map((s) => [s.slug, s.id]));
const missing = [...new Set(parsed.data.hours.map((h) => h.slug))].filter(
  (slug) => !idBySlug.has(slug),
);
if (missing.length > 0) {
  console.error("Unknown slugs in hours.json (seed spots first):", missing);
  process.exit(1);
}

const { error: deleteError } = await supabase
  .from("spot_hours")
  .delete()
  .eq("source", SOURCE);
if (deleteError) {
  console.error("Cleanup of previous provisional rows failed:", deleteError.message);
  process.exit(1);
}

const rows = parsed.data.hours.map((h) => ({
  spot_id: idBySlug.get(h.slug),
  day_of_week: h.day_of_week,
  opens: h.opens,
  closes: h.closes,
  source: SOURCE,
}));
const { error: insertError } = await supabase.from("spot_hours").insert(rows);
if (insertError) {
  console.error("Insert failed:", insertError.message);
  process.exit(1);
}

console.log(`Seeded ${rows.length} ${SOURCE} hour rows across ${idBySlug.size} known spots.`);
