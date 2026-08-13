import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { CHIPS_BY_CATEGORY } from "@/lib/filters";
import { mentionsBuilding, zoneName } from "@/lib/spot-name";
import { getVerdict } from "@/lib/status";
import type { SpotListItem } from "@/lib/types";

// Mockup sub-line pattern: "Coffee · Commons" — up to two attribute
// descriptors, then building. Truthful by construction: descriptors are the
// same chip predicates the filters use. (Walk time joins when §Phase 0's
// anchor points exist.)
//
// One ordering rule (Phase 7 copy pass): when the title had its building
// stripped, the building leads the sub-line instead of trailing it. "2nd Floor
// Study Area" does not locate itself the way "Chick-fil-A" does, so whichever
// line carries the building has to surface it first.
function subLine(item: SpotListItem, title: string): string {
  // Food rows show the location and nothing else (Alan, 2026-08-07). A food
  // spot's name already tells you what it is — "Chick-fil-A · Coffee · Vegan"
  // spends the line on things you could guess, when the only open question is
  // where to walk. Study zones still carry descriptors: "2nd Floor Study Area"
  // says nothing about whether you can talk there.
  if (item.category === "food") return item.building;

  const a = item.attributes;
  const descriptors =
    typeof a === "object" && a !== null && !Array.isArray(a)
      ? CHIPS_BY_CATEGORY[item.category]
          .filter((chip) => chip.match(a as Record<string, never>))
          .slice(0, 2)
          .map((chip) => chip.label)
      : [];
  // Title already says the building ("Administration", or a Best bet keeping
  // its full name) — repeating it below is the noise this pass exists to cut.
  if (mentionsBuilding(title, item.building)) return descriptors.join(" · ");
  // Title had the building stripped, so the sub-line has to lead with it:
  // "2nd Floor Study Area" does not locate itself the way "Chick-fil-A" does.
  if (title !== item.name) return [item.building, ...descriptors].join(" · ");
  return [...descriptors, item.building].join(" · ");
}

// One glance = one decision (§4.2): name + sub-line left, ONE status word +
// freshness right. Beli-style — no card box; the hairline divider comes from
// the parent list. Layout and type sizes lifted from mockup `.lrow`.
// `best` renders the §4.2 Best bet treatment: gold-soft wash card, star +
// microlabel, consensus line. That row IS the recommender — no separate UI.
export function SpotRow({
  item,
  now,
  best = false,
}: {
  item: SpotListItem;
  now: Date;
  best?: boolean;
}) {
  const verdict = getVerdict(item, now);
  // The Best bet keeps its full name. §4.2 makes this row the recommender, and
  // it is the one row read in isolation and acted on — "2nd Floor" is not an
  // answer a student can walk to. The dense list below it is a comparison,
  // where the repeated building is noise; the hero row is not.
  const title = best ? item.name : zoneName(item.name, item.building);

  return (
    <Link
      href={`/spots/${item.slug}`}
      // Full prefetch (Next 16: dynamic routes get no data prefetch by
      // default): each visible row fetches its detail payload on viewport
      // entry, so the tap-to-detail transition is instant in production.
      // ~16 spots × a small RSC payload — cheap insurance.
      prefetch={true}
      // Two different tap feedbacks on purpose (§4.6). The Best bet is a CARD,
      // so it scales like every other card-shaped control. A plain list row is
      // full-bleed against hairline dividers — scaling it would drag the
      // dividers with it and read as a glitch, so it flashes its surface
      // instead. Same signal, shape-appropriate.
      className={`flex items-center justify-between gap-3 transition-[background-color,transform] duration-100 ease-out motion-reduce:transition-none ${
        best
          ? "mx-2.5 mb-1.5 rounded-card bg-gold-soft px-3.5 py-3.75 active:scale-98"
          : "px-4.5 py-3.75 active:bg-soft"
      }`}
    >
      <div>
        {best && (
          // Label gold #8A6A00 comes from the mockup's .best-tag — the one
          // place plain --gold fails 4.5:1 contrast on the wash.
          <div className="mb-1 flex items-center gap-1.25 text-[10px] font-extrabold uppercase tracking-[0.09em] text-[#8A6A00]">
            <svg aria-hidden width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7L12 2z" />
            </svg>
            Best bet
          </div>
        )}
        <div className="text-[15.5px] font-bold tracking-[-0.015em]">
          {title}
        </div>
        {/* Food's location line wears --mustard (§4.1 amendment 2026-08-07);
            study keeps --muted, because its sub-line is a list of attributes
            rather than a place and colouring it would be decoration. */}
        <div
          className={`mt-[2.5px] text-xs leading-[1.4] ${
            item.category === "food" ? "text-mustard" : "text-muted"
          }`}
        >
          {subLine(item, title)}
        </div>
        {/* The §3.3 consensus sentence used to render here on the Best Bet row
            (Alan, 2026-08-04: removed). The row already answers the question —
            name, building, live verdict, freshness — and an editorial quote on
            top of it competes with the status word for the same glance. The
            sentence still exists in the data and on the spot detail page, where
            there is room for editorial and the reader has already committed. */}
      </div>
      <div className="shrink-0 text-right">
        <StatusBadge word={verdict.word} tone={verdict.tone} />
        {verdict.fresh && (
          <div
            className={`mt-0.75 text-[10px] ${
              verdict.freshMono === false ? "" : "font-mono"
            } ${verdict.freshTone === "hold" ? "text-hold" : "text-muted"}`}
          >
            {verdict.fresh}
          </div>
        )}
      </div>
    </Link>
  );
}
