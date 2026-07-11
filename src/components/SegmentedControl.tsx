"use client";

import type { Category } from "@/lib/types";

// Food | Study segmented control (§4.2) — styling lifted verbatim from
// DESIGN_REFERENCE.html `.modes`: soft track, white sliding thumb.
export function SegmentedControl({
  value,
  onChange,
}: {
  value: Category;
  onChange: (value: Category) => void;
}) {
  return (
    <div role="tablist" className="relative flex rounded-control bg-soft p-0.75">
      <div
        className={`absolute inset-y-0.75 left-0.75 w-[calc(50%-3px)] rounded-[5px] bg-sheet shadow-[0_1px_4px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.03)] transition-transform duration-180 ease-out motion-reduce:transition-none ${
          value === "study" ? "translate-x-full" : ""
        }`}
      />
      {(["food", "study"] as const).map((category) => (
        <button
          key={category}
          role="tab"
          aria-selected={value === category}
          onClick={() => onChange(category)}
          className={`relative z-1 flex-1 rounded-[5px] py-2.5 text-[14.5px] font-bold capitalize transition-colors duration-150 before:absolute before:inset-x-0 before:-inset-y-0.5 motion-reduce:transition-none ${
            value === category ? "text-black" : "text-muted"
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
