// Zod schema for scraper/seed/spots.json (BUILD_PLAN §3, Phase 0 exit criterion).
// The seed carries one extra field the spots table doesn't: hours_source, the
// mapping the scraper uses to match a spot to its row in the scraped feeds.
import { z } from "zod";

// §3.2 — attributes are static and category-specific. .partial() because Alan
// hasn't filled every tag yet (blanks stay blank); .strict() so a typo'd key
// fails validation instead of silently becoming an unfilterable attribute.
const foodAttributes = z
  .object({
    coffee: z.boolean(),
    vegetarian: z.boolean(),
    vegan: z.boolean(),
    halal: z.boolean(),
    open_late: z.boolean(),
    meal_swipe: z.boolean(),
    mobile_order: z.boolean(),
  })
  .partial()
  .strict();

// §3.2 amended 2026-08-04 (Alan, study recon): the original enums were written
// in Phase 0, before any zone had been walked. Alan's firsthand recon uses a
// richer vocabulary, and translating his words into the old values would have
// silently destroyed the distinctions he went and observed. The schema moves to
// the data, not the other way round.
const studyAttributes = z
  .object({
    // `silent` predates `noise` and drives the Silent filter chip. Kept so the
    // already-seeded AOK rows stay valid; `noise` carries the full reading.
    silent: z.boolean(),
    noise: z.enum(["silent", "quiet", "mid", "loud", "varies"]),
    group_ok: z.boolean(),
    outlets: z.enum(["good", "limited", "bad"]),
    whiteboards: z.boolean(),
    open_24h: z.boolean(),
    near_food: z.boolean(),
    // Gains desks/cubbies/booths/balcony from the recon vocabulary.
    seating: z.enum([
      "tables",
      "couches",
      "mixed",
      "desks",
      "cubbies",
      "booths",
      "balcony",
    ]),
    // How reliably a seat is free — a STATIC tendency, deliberately not the
    // §3.4 time-of-day baseline. "Almost always empty, very quiet" is the
    // single most useful thing the recon captured, and it had nowhere to live.
    fill_tendency: z.enum([
      "reliably_open",
      "usually_open",
      "varies",
      "usually_taken",
      "reliably_full",
    ]),
  })
  .partial()
  .strict();

// §3.4 — { "mon-fri": { "midday": "packed", ... }, ... }; {} until Alan seeds it.
const baseline = z.record(z.string(), z.record(z.string(), z.string()));

// How the scraper finds this spot's hours. source_slug/source_lid come from the
// Phase 0 fixtures and must match the feed exactly (e.g. Admin Coffee Shop is
// "the-coffee-shoppe" in the dining feed).
const hoursSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dining"), source_slug: z.string() }),
  z.object({ kind: z.literal("library"), source_lid: z.number().int() }),
  z.object({ kind: z.literal("manual") }),
]);

// Campus bounding box — a lat/lng typo (or swapped columns) fails loudly here.
const campusLat = z.number().min(39.24).max(39.27);
const campusLng = z.number().min(-76.73).max(-76.69);

const spotBase = {
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  building: z.string().min(1),
  lat: campusLat,
  lng: campusLng,
  consensus: z.string().max(90).nullable(), // §3.3; null = pending Alan
  baseline,
  hours_source: hoursSource,
};

export const spotSchema = z.discriminatedUnion("category", [
  z.object({ category: z.literal("food"), attributes: foodAttributes, ...spotBase }),
  z.object({ category: z.literal("study"), attributes: studyAttributes, ...spotBase }),
]);

export const seedFileSchema = z.object({
  _meta: z.object({
    status: z.string(),
    generated: z.string(),
    notes: z.array(z.string()),
  }),
  spots: z
    .array(spotSchema)
    .superRefine((spots, ctx) => {
      const seen = new Set<string>();
      for (const s of spots) {
        if (seen.has(s.slug)) ctx.addIssue({ code: "custom", message: `duplicate slug: ${s.slug}` });
        seen.add(s.slug);
      }
    }),
});

export type Spot = z.infer<typeof spotSchema>;
