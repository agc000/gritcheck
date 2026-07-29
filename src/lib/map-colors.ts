// Walking-path color, shared by the style JSON's road-path layer and the
// legend's walk icon so the two can never drift (MapLibre paints from the
// static JSON; the legend paints from React — grep for PATH_COLOR when
// changing public/map-style.json).
//
// Steel blue on purpose: §4.1's warm hues (go/hold/skip/gold) are reserved
// for status and selection, so the one non-status highlight on the map sits
// far from them on the hue wheel. Category building tints were tried in this
// slot and reverted (2026-07-24) — paths are the only survivor.
export const PATH_COLOR = "#6E8B99";
