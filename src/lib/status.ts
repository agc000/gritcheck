import type { Json } from "./database.types";
import { nextOpensToday, nyClock } from "./time";
import type { SpotListItem } from "./types";

// UI verdicts (§4.3): one word + one status color per row. This maps the
// aggregation view's raw fields to display language. The decay math itself
// lives in SQL (§5.4); a client mirror of it arrives in Phase 4 — this module
// only translates already-aggregated values.

export type Tone = "go" | "hold" | "skip" | "closed";

export type Verdict = {
  word: string;
  tone: Tone;
  /** Sub-line under the status word: a freshness stamp, or "typically". */
  fresh: string | null;
  /** §4.4: 1–3 h old freshness renders in --hold, everything else faint. */
  freshTone: "faint" | "hold";
  /**
   * §4.1 reserves Spline Sans Mono for timestamps and data. "8 min ago" is
   * data; "typically" is a qualifier, so it sets this false and renders in the
   * UI face instead.
   */
  freshMono?: boolean;
};

// ONE scale, three bands (§4.3 amendment 2026-08-07). Live rows and baseline
// rows now speak the same words, and those words are the map legend's, so a
// spot reads identically as a dot, as a row with a fresh report, and as a row
// with none. Before this, the same study room said "Seats open" with a report
// and "Empty" without — the word changed on something the reader cannot see.
//
// Food keeps a line-shaped word at the go end because "Empty" answers the study
// question, not the food one. The hold and skip bands are shared: a full room
// and a long line carry the same instruction.
//
// This also resolves the §4.3 ruling that was pending here — the mockup colored
// "Normal line" green; the hold band is amber, in both categories. Study
// previously had NO hold band (`normal` was ["Seats open", "go"]), so an
// average study room advised go while an average food line advised hold.
const FOOD_VERDICTS: Record<string, [string, Tone]> = {
  short: ["Short line", "go"],
  normal: ["In between", "hold"],
  long: ["Full", "skip"],
};

const STUDY_VERDICTS: Record<string, [string, Tone]> = {
  empty: ["Empty", "go"],
  normal: ["In between", "hold"],
  packed: ["Full", "skip"],
};

// Baseline verdicts (§4.3 amendment 2026-08-04). THREE states, and they are the
// map legend's words verbatim — Empty / In between / Full — so the colour scale
// reads identically whether you are looking at a dot or a row. A student should
// not have to learn two vocabularies for one product.
//
// §3.4's data vocabulary keeps its four values because the seeded baselines
// already use them and the extra shade is worth storing; `quiet` simply lands
// in the same bucket as `empty` for display. Storing more than you show is
// cheap; showing a distinction the reader did not ask for is not.
//
// The "typically" qualifier lives in the sub-line, not in the word (Alan,
// 2026-08-04): the word should be the answer at a glance, and the caveat
// should be available without competing with it.
const BASELINE_VERDICTS: Record<string, [string, Tone]> = {
  empty: ["Empty", "go"],
  quiet: ["Empty", "go"],
  normal: ["In between", "hold"],
  packed: ["Full", "skip"],
};

// Day-part boundaries for baseline lookup (§3.4). Constants, not magic
// numbers, per §5.3's spirit — tune once real usage shows the real rhythm.
const DAY_PARTS: Array<{ from: number; to: number; part: string }> = [
  { from: 5, to: 11, part: "morning" },
  { from: 11, to: 14, part: "midday" },
  { from: 14, to: 17, part: "afternoon" },
  { from: 17, to: 24, part: "evening" },
];

/** "quiet" | "normal" | "packed" | "empty" from the baseline JSONB, or null. */
export function baselineWord(baseline: Json, now: Date): string | null {
  if (typeof baseline !== "object" || baseline === null || Array.isArray(baseline)) {
    return null;
  }
  // Campus time, not server time — Vercel renders in UTC (§5.4).
  const { dow, minutes } = nyClock(now);
  const dayKey = dow === 0 || dow === 6 ? "sat-sun" : "mon-fri";
  const slots = (baseline as Record<string, Json>)[dayKey];
  if (typeof slots !== "object" || slots === null || Array.isArray(slots)) {
    return null;
  }
  const hour = minutes / 60;
  const part = DAY_PARTS.find((p) => hour >= p.from && hour < p.to)?.part;
  const record = slots as Record<string, Json>;
  const word = (part && record[part]) ?? record["all"];
  return typeof word === "string" ? word : null;
}

function freshness(lastUpdateAt: string | null, now: Date) {
  if (!lastUpdateAt) return null;
  const minutes = Math.round(
    (now.getTime() - new Date(lastUpdateAt).getTime()) / 60_000,
  );
  if (minutes < 0) return null;
  if (minutes < 60) {
    return { fresh: `${minutes} min ago`, freshTone: "faint" as const };
  }
  if (minutes < 180) {
    return { fresh: `${Math.round(minutes / 60)} h ago`, freshTone: "hold" as const };
  }
  return null; // ≥3 h is never presented as current (§4.4); baseline takes over.
}

// The live-data verdict alone, or null when there is nothing current enough
// to show: the view only reports fields inside the 3 h window, and confidence
// Low means "treat as no data" (§4.5). Exported so the map can color status
// glow by the same rule the rows use — two sources of "is this live" would
// eventually disagree.
export function liveVerdict(item: SpotListItem, now: Date): Verdict | null {
  if (!item.isOpen) return null;
  const live = freshness(item.lastUpdateAt, now);
  const hasConfidence =
    item.confidence === "high" || item.confidence === "medium";
  if (!live || !hasConfidence) return null;
  if (item.category === "food") {
    // A packed room overrides the line: a short line inside a jammed dining
    // hall is not a short wait. "Full", not "Packed" — same word as every
    // other skip-band reading (§4.3 amendment 2026-08-07).
    if (item.crowd === "packed") {
      return { word: "Full", tone: "skip", ...live };
    }
    const mapped = item.line ? FOOD_VERDICTS[item.line] : undefined;
    if (mapped) return { word: mapped[0], tone: mapped[1], ...live };
  } else {
    const mapped = item.crowd ? STUDY_VERDICTS[item.crowd] : undefined;
    if (mapped) return { word: mapped[0], tone: mapped[1], ...live };
  }
  return null;
}

/**
 * The tone a spot's ROW would show — live reading if there is one, otherwise
 * the hour's baseline. Null when the spot is closed, or when nothing is known
 * for this hour.
 *
 * Exists so the map's dots can say the same thing the list says. Deliberately
 * derived from the same two functions the rows use rather than reimplemented:
 * a second copy of "what colour is this spot" would drift, which is the whole
 * reason `liveVerdict` was exported in the first place.
 *
 * Note it never returns "hold" for ignorance. `getVerdict` falls through to
 * `No recent data` with a hold tone, which is right for a row (the word carries
 * the meaning) and wrong for a dot (an amber dot with no word beside it is an
 * amber claim). Unknown must stay colourless on the map.
 */
export function expectedTone(
  item: SpotListItem,
  now: Date,
): Exclude<Tone, "closed"> | null {
  if (!item.isOpen) return null;
  const live = liveVerdict(item, now);
  if (live) return live.tone === "closed" ? null : live.tone;
  const typical = baselineWord(item.baseline, now);
  const mapped = typical ? BASELINE_VERDICTS[typical] : undefined;
  return mapped ? (mapped[1] as Exclude<Tone, "closed">) : null;
}

export function getVerdict(item: SpotListItem, now: Date): Verdict {
  if (!item.isOpen) {
    // "opens 7 AM" when there's a later opening today (mockup's closed row).
    return {
      word: "Closed",
      tone: "closed",
      fresh: nextOpensToday(item.hours, nyClock(now).minutes),
      freshTone: "faint",
    };
  }

  const live = liveVerdict(item, now);
  if (live) return live;

  // Baseline as PRIMARY (§5.3: "Low → UI shows baseline as primary with
  // 'typical' framing"). It previously led with "No recent data" and demoted
  // the baseline to grey sub-text — which inverted the spec and, with zero
  // updates on day one, made a campus we genuinely know a lot about read as an
  // empty app. "Usually" carries the honesty; nothing is dressed up as live.
  const typical = baselineWord(item.baseline, now);
  const mapped = typical ? BASELINE_VERDICTS[typical] : undefined;
  if (mapped) {
    return {
      word: mapped[0],
      tone: mapped[1],
      fresh: "typically",
      freshTone: "faint",
      freshMono: false,
    };
  }

  // Genuinely nothing known for this spot at this hour — no live data and no
  // baseline covering this day-part. Saying so is still the right answer.
  return { word: "No recent data", tone: "hold", fresh: null, freshTone: "faint" };
}
