"use client";

import { useState } from "react";
import type { FilterChip } from "@/lib/filters";

// Horizontal chip row (mockup `.chips`/`.chip`). Active chip = black pill
// with gold text — the §4.1-sanctioned "active filter" gold. Single-select:
// tapping the active chip (or All) clears it.
export function FilterChips({
  chips,
  activeId,
  onChange,
}: {
  chips: FilterChip[];
  activeId: string | null;
  onChange: (id: string | null) => void;
}) {
  // before: pseudo stretches the hit area to ≥44px (§4.8) without touching
  // the 35px visual — the mockup's chip proportions are law.
  //
  // It was silently doing nothing until 2026-08-07. `overflow-x-auto` on the
  // scroller below computes overflow-y to `auto` too (CSS: a `visible` axis
  // paired with a non-visible one becomes `auto`), so the scrollport clipped
  // the pseudo's 5px overhang and the hit area measured 36px — the chips'
  // §4.8 failure was a *clipped fix*, not a missing one. The scroller now
  // carries py-1.5 so the overhang lands inside its padding box, where
  // overflow does not clip. Verified by re-probing with elementFromPoint.
  const chipClass = (selected: boolean) =>
    `relative flex-none rounded-md border px-3.5 py-1.75 text-[12.5px] font-semibold transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-97 before:absolute before:inset-x-0 before:-inset-y-1.25 motion-reduce:transition-none ${
      selected
        ? "border-black bg-black text-gold"
        : "border-line bg-sheet text-muted"
    }`;

  // Whether the row can still scroll right. Starts true because it always can
  // at the shipped chip counts (7 food / 8 study = 553px / 691px of chips in a
  // 238px rail), and a scroll handler is the only honest way to learn
  // otherwise — measuring during render would trip react-hooks/refs, and an
  // effect would trip react-hooks/set-state-in-effect. Both are CI errors.
  const [canScrollRight, setCanScrollRight] = useState(true);

  return (
    <div className="relative min-w-0 flex-1">
      {/* py-1.5 gives the chips' hit-area pseudo room inside the scrollport;
          -my-1.5 cancels it in layout so the subbar keeps its exact height. */}
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          // 1px slack: fractional scroll widths never land exactly on 0.
          setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
        }}
        className="-my-1.5 flex gap-1.5 overflow-x-auto py-1.5 scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        <button
          aria-pressed={activeId === null}
          onClick={() => onChange(null)}
          className={chipClass(activeId === null)}
        >
          All
        </button>
        {chips.map((chip) => (
          <button
            key={chip.id}
            aria-pressed={activeId === chip.id}
            onClick={() => onChange(activeId === chip.id ? null : chip.id)}
            className={chipClass(activeId === chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {/* The §4.1-amended second sanctioned gradient: the ONLY signal that more
          filters exist off-screen (the audit found 3 of 8 reachable with no
          affordance at all). pointer-events-none so it never eats a chip tap —
          same load-bearing reason as the map placeholder (§Phase 5 item 6).
          Hidden once the row is scrolled out, so the last chip is never
          permanently dimmed. */}
      {canScrollRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l from-sheet to-transparent"
        />
      )}
    </div>
  );
}
