// Map annotation palette (Alan, 2026-07-24: "highlight walking paths + a
// little legend"). Lives here, not in globals.css, because MapLibre paints
// from JS and can't read CSS custom properties — the legend chip imports the
// same constants so the swatches can never drift from the map.
//
// HUE RULE (the reason these are all cool): the §4.1 status palette owns warm
// — go green, hold amber, skip red, and gold as pure signal. A dot or glow in
// those colors means "how busy is it right now", which is the product's whole
// point. Category tints therefore live in teal→blue→violet, where nothing can
// be mistaken for a verdict. "Both" sitting between food and study on the hue
// wheel is deliberate: the blend reads as the union of the two.
//
// These are context washes on large extruded footprints, so they stay dark
// and desaturated — the small saturated status dots must always win the eye.
export const MAP_COLORS = {
  /** Building holds food spots only. */
  food: "#35706B",
  /** Building holds study spots only. */
  study: "#554A82",
  /** Building holds both. */
  both: "#3E6288",
  /** Footpaths/pedestrian ways — the "how do I walk there" layer. */
  path: "#6E8B99",
} as const;
