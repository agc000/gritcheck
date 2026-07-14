import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { CHIPS_BY_CATEGORY } from "@/lib/filters";
import { getVerdict } from "@/lib/status";
import type { SpotListItem } from "@/lib/types";

// Mockup sub-line pattern: "Coffee · Commons" — up to two attribute
// descriptors, then building. Truthful by construction: descriptors are the
// same chip predicates the filters use. (Walk time joins when §Phase 0's
// anchor points exist.)
function subLine(item: SpotListItem): string {
  const a = item.attributes;
  const descriptors =
    typeof a === "object" && a !== null && !Array.isArray(a)
      ? CHIPS_BY_CATEGORY[item.category]
          .filter((chip) => chip.match(a as Record<string, never>))
          .slice(0, 2)
          .map((chip) => chip.label)
      : [];
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

  return (
    <Link
      href={`/spots/${item.slug}`}
      // Full prefetch (Next 16: dynamic routes get no data prefetch by
      // default): each visible row fetches its detail payload on viewport
      // entry, so the tap-to-detail transition is instant in production.
      // ~16 spots × a small RSC payload — cheap insurance.
      prefetch={true}
      className={`flex items-center justify-between gap-3 transition-colors duration-100 ${
        best
          ? "mx-2.5 mb-1.5 rounded-card bg-gold-soft px-3.5 py-3.75"
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
          {item.name}
        </div>
        <div className="mt-[2.5px] text-xs leading-[1.4] text-muted">
          {subLine(item)}
        </div>
        {best && item.consensus && (
          <div className="mt-1 text-xs italic text-muted">
            &ldquo;{item.consensus}&rdquo;
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <StatusBadge word={verdict.word} tone={verdict.tone} />
        {verdict.fresh && (
          <div
            className={`mt-0.75 font-mono text-[10px] ${
              verdict.freshTone === "hold" ? "text-hold" : "text-muted"
            }`}
          >
            {verdict.fresh}
          </div>
        )}
      </div>
    </Link>
  );
}
