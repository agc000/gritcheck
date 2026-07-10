"use client";

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
  const chipClass = (selected: boolean) =>
    `flex-none rounded-full border px-3.5 py-1.75 text-[12.5px] font-semibold transition-colors duration-150 motion-reduce:transition-none ${
      selected
        ? "border-black bg-black text-gold"
        : "border-line bg-sheet text-muted"
    }`;

  return (
    <div className="flex flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
  );
}
