// Map annotation palette. Lives here, not in globals.css, because MapLibre
// paints from JS and can't read CSS custom properties — the legend chip
// imports the same constant so the swatch can never drift from the map.
//
// Only the path color needs this treatment. The legend's status swatches use
// the §4.1 Tailwind tokens (bg-go / bg-hold / bg-skip / bg-closed) directly,
// since those ARE theme colors; the map hardcodes the same hexes in
// MapView's TONE_COLORS.
//
// (Category tints for food/study/both lived here briefly on 2026-07-24 and
// were reverted the same day — Alan: the extra hues muddied a map whose only
// color language should be status.)
export const MAP_COLORS = {
  /** Footpaths/pedestrian ways — the "how do I walk there" layer. */
  path: "#6E8B99",
} as const;
