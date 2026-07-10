"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { Category, SpotListItem } from "@/lib/types";

// Client owner of browse state (tab now; filters/sort in tasks 5–6). Local
// component state, not a store or URL — it's ephemeral view state with exactly
// one consumer, and the full spot list is already in props (§12 Phase 2).
export function SpotBrowser({ items }: { items: SpotListItem[] }) {
  const [category, setCategory] = useState<Category>("food");

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
        // PLACEHOLDER list markup — replaced by SpotRow/StatusBadge in task 3.
        <ul className="divide-y divide-line px-5">
          {visible.map((item) => (
            <li
              key={item.slug}
              className="flex items-baseline justify-between gap-4 py-3"
            >
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-muted">{item.building}</div>
              </div>
              <div
                className={`shrink-0 font-mono text-xs ${item.isOpen ? "text-go" : "text-closed"}`}
              >
                {item.isOpen ? "open" : "closed"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
