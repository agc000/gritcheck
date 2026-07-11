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
  /** Mono sub-line under the status word: freshness or "typical: X". */
  fresh: string | null;
  /** §4.4: 1–3 h old freshness renders in --hold, everything else faint. */
  freshTone: "faint" | "hold";
};

// Traffic-light semantics match the token names: short line = go, normal =
// hold, long/packed = skip. (Deliberate deviation from the mockup, which
// colored "Normal line" green — flagged to Alan for a §4.3 ruling.)
const FOOD_VERDICTS: Record<string, [string, Tone]> = {
  short: ["Short line", "go"],
  normal: ["Normal line", "hold"],
  long: ["Long line", "skip"],
};

const STUDY_VERDICTS: Record<string, [string, Tone]> = {
  empty: ["Quiet", "go"],
  normal: ["Seats open", "go"],
  packed: ["Packed", "skip"],
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

  // Live data path: the view only reports fields inside the 3 h window, and
  // confidence Low means "treat as no data" (§4.5).
  const live = freshness(item.lastUpdateAt, now);
  const hasConfidence =
    item.confidence === "high" || item.confidence === "medium";
  if (live && hasConfidence) {
    if (item.category === "food") {
      if (item.crowd === "packed") {
        return { word: "Packed", tone: "skip", ...live };
      }
      const mapped = item.line ? FOOD_VERDICTS[item.line] : undefined;
      if (mapped) return { word: mapped[0], tone: mapped[1], ...live };
    } else {
      const mapped = item.crowd ? STUDY_VERDICTS[item.crowd] : undefined;
      if (mapped) return { word: mapped[0], tone: mapped[1], ...live };
    }
  }

  // Baseline fallback (§3.4): honest "typical" framing, never dressed up as
  // a live reading — the mockup's "No recent data · typical: quiet" pattern.
  const typical = baselineWord(item.baseline, now);
  return {
    word: "No recent data",
    tone: "hold",
    fresh: typical ? `typical: ${typical}` : null,
    freshTone: "faint",
  };
}
