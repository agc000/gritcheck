// The `building` column is descriptive ("Commons ground floor", "True Grit's
// (residential side)"), not a key — strip floor/parenthetical qualifiers so
// one building gets one identity. Shared by the server (map marker grouping),
// the map (geojson feature keys match this), and the sheet (building-filter
// matching). TODO(seed): a canonical building key in spots.json is the honest
// fix; flagged for Alan's next data pass.
export const buildingKey = (b: string) =>
  b
    .replace(/\s*\(.+\)$/, "")
    .replace(/\s+(ground|\d+(?:st|nd|rd|th))\s+floor$/i, "")
    .trim();

// One row of the Find Building tab: every campus building (the 5 interactive
// spot buildings merged with the OSM label points), assembled server-side in
// page.tsx.
export type CampusBuilding = {
  name: string;
  lat: number;
  lng: number;
  /** Set for the interactive five — tapping gold-selects the footprint. */
  buildingKey?: string;
  /** Spot count for the interactive five (row sub-text). */
  spots?: number;
};
