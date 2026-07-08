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

const studyAttributes = z
  .object({
    silent: z.boolean(),
    group_ok: z.boolean(),
    outlets: z.enum(["good", "limited", "bad"]),
    whiteboards: z.boolean(),
    open_24h: z.boolean(),
    near_food: z.boolean(),
    seating: z.enum(["tables", "couches", "mixed"]),
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
