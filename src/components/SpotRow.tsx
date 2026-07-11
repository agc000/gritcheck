import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { getVerdict } from "@/lib/status";
import type { SpotListItem } from "@/lib/types";

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
          {item.building}
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
              verdict.freshTone === "hold" ? "text-hold" : "text-faint"
            }`}
          >
            {verdict.fresh}
          </div>
        )}
      </div>
    </Link>
  );
}
