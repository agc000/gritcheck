// Row titles: drop the building prefix when the building is already shown
// beside it.
//
// Every one of the 35 study spots is named `{Building} — {Zone}`
// ("Chemistry — Upper Levels", "AOK (Library) — 2nd Floor Study Area"), and
// every surface that shows a name also shows `building` right underneath —
// the browse sub-line, the update sheet's spot picker, the detail header. So
// the building was printing twice on every study row, and the long titles
// wrapped to two lines at 390px, which breaks §4.2's "one glance = one
// decision" row rhythm.
//
// This is display-only on purpose. The stored name stays the fully-qualified
// one, because it is the right string everywhere the building is NOT adjacent:
// OG images, <title>, search, and anything shared out of context.

/** Lowercase alphanumerics only — "AOK (Library)" and "AOK Library" both
 *  normalize to "aoklibrary", which is the whole reason this is fuzzy. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Em dash, en dash, or a hyphen with spaces around it. Deliberately NOT a bare
// hyphen: "Chick-fil-A" and "3rd/4th Floor (Quiet)" must survive untouched.
const SEPARATOR = /\s+[—–]\s+|\s+-\s+/;

// A zone covering the whole building names no place of its own — stripping
// "Administration — Building-wide" down to "Building-wide" leaves a row titled
// with a shape rather than a location. For these the building IS the place.
const WHOLE_BUILDING = /^building[-\s]?wide$/i;

/**
 * "Chemistry — Upper Levels" + building "Chemistry" → "Upper Levels".
 * Returns the name unchanged when the head is not the building (food spots,
 * which are named for the venue, and any study zone that stops following the
 * convention).
 */
export function zoneName(name: string, building: string): string {
  const at = name.search(SEPARATOR);
  if (at === -1) return name;

  const head = name.slice(0, at);
  const tail = name.slice(at).replace(SEPARATOR, "");
  if (!tail) return name;

  const h = normalize(head);
  const b = normalize(building);
  // Either direction: the name may abbreviate the building ("AOK" for "AOK
  // Library") or spell it out more fully than the building column does.
  if (h && b && (h === b || b.startsWith(h) || h.startsWith(b))) {
    return WHOLE_BUILDING.test(tail) ? building : tail;
  }
  return name;
}

/** Does the title already carry the building, making a sub-line repeat noise? */
export function mentionsBuilding(title: string, building: string): boolean {
  const t = normalize(title);
  const b = normalize(building);
  return t.length > 0 && b.length > 0 && (t.includes(b) || b.includes(t));
}
