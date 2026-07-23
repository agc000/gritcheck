"use client";

import { StatusBadge } from "@/components/StatusBadge";
import { useNowMs } from "@/lib/clock";
import { baselineWord, getVerdict } from "@/lib/status";
import type { SpotListItem } from "@/lib/types";

// §4.5: three bars driven by the aggregation weight, always with the reason.
function ConfidenceBars({ item, now }: { item: SpotListItem; now: Date }) {
  const level =
    item.confidence === "high" ? 3 : item.confidence === "medium" ? 2 : 1;
  const typical = baselineWord(item.baseline, now);
  const reason =
    level === 3
      ? "several reports this hour"
      : level === 2
        ? "a recent report or two"
        : typical
          ? "no recent reports — based on typical pattern"
          : "no recent reports";

  return (
    <div>
      <div className="flex items-center gap-1">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`h-1 w-6 rounded-full ${bar <= level ? "bg-ink" : "bg-line"}`}
          />
        ))}
        <span className="ml-2 text-xs font-semibold capitalize">
          {item.confidence ?? "low"} confidence
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">{reason}</p>
    </div>
  );
}

// The detail page's status card, client-side so it re-verdicts on the live
// clock (§4.4): server-painted for the first paint via the server snapshot,
// then freshness/cutoffs track real time — a tab left open (or a service-
// worker-cached page) ages out of "8 min ago" instead of asserting it
// forever.
export function SpotStatusCard({
  item,
  nowMs,
}: {
  item: SpotListItem;
  nowMs: number;
}) {
  const now = new Date(useNowMs(nowMs));
  const verdict = getVerdict(item, now);
  const typical = baselineWord(item.baseline, now);

  return (
    <section className="mt-5 rounded-card bg-soft p-4">
      <div className="flex items-baseline justify-between">
        <StatusBadge word={verdict.word} tone={verdict.tone} />
        {verdict.fresh && (
          <span
            className={`font-mono text-xs ${
              verdict.freshTone === "hold" ? "text-hold" : "text-muted"
            }`}
          >
            {verdict.fresh.startsWith("opens") || verdict.fresh.startsWith("typical")
              ? verdict.fresh
              : `as of ${verdict.fresh}`}
          </span>
        )}
      </div>
      <div className="mt-3">
        <ConfidenceBars item={item} now={now} />
      </div>
      {typical && (
        <p className="mt-2 text-xs text-muted">
          Typical right now: <span className="font-semibold">{typical}</span>
        </p>
      )}
    </section>
  );
}
