"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SpotRow } from "@/components/SpotRow";
import type { Category, SpotListItem } from "@/lib/types";

// Client owner of browse state (tab now; filters/sort in tasks 5–6). Local
// component state, not a store or URL — it's ephemeral view state with exactly
// one consumer, and the full spot list is already in props (§12 Phase 2).
// `nowMs` comes from the server render so hydration sees identical output.
export function SpotBrowser({
  items,
  nowMs,
}: {
  items: SpotListItem[];
  nowMs: number;
}) {
  const [category, setCategory] = useState<Category>("food");
  const now = new Date(nowMs);

  const visible = items.filter((item) => item.category === category);

  return (
    <div>
      <div className="sticky top-0 z-10 bg-sheet px-4 pt-1 pb-3">
        <SegmentedControl value={category} onChange={setCategory} />
      </div>

      {visible.length === 0 ? (
        // PLACEHOLDER empty state — Grits + proper copy land in task 8.
        <p className="px-5 py-10 text-center text-sm text-muted">
          No {category} spots yet.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((item) => (
            <li key={item.slug}>
              <SpotRow item={item} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
