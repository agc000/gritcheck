import { StatusBadge } from "@/components/StatusBadge";
import { getVerdict } from "@/lib/status";
import type { SpotListItem } from "@/lib/types";

// One glance = one decision (§4.2): name + sub-line left, ONE status word +
// freshness right. Beli-style — no card box; the hairline divider comes from
// the parent list. Layout and type sizes lifted from mockup `.lrow`.
export function SpotRow({ item, now }: { item: SpotListItem; now: Date }) {
  const verdict = getVerdict(item, now);

  return (
    <div className="flex items-center justify-between gap-3 px-[18px] py-[15px] transition-colors duration-100 active:bg-soft">
      <div>
        <div className="text-[15.5px] font-bold tracking-[-0.015em]">
          {item.name}
        </div>
        <div className="mt-[2.5px] text-xs leading-[1.4] text-muted">
          {item.building}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <StatusBadge word={verdict.word} tone={verdict.tone} />
        {verdict.fresh && (
          <div
            className={`mt-[3px] font-mono text-[10px] ${
              verdict.freshTone === "hold" ? "text-hold" : "text-faint"
            }`}
          >
            {verdict.fresh}
          </div>
        )}
      </div>
    </div>
  );
}
