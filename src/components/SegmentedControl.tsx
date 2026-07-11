"use client";

import type { Category } from "@/lib/types";

// Food | Study segmented control (§4.2) — structure from DESIGN_REFERENCE.html
// `.modes` (soft track, sliding thumb); colors follow §4.1 as amended
// 2026-07-11 (navy palette), which supersedes the mockup's white thumb.
export function SegmentedControl({
  value,
  onChange,
}: {
  value: Category;
  onChange: (value: Category) => void;
}) {
  return (
    <div role="tablist" className="relative flex rounded-control bg-soft p-0.75">
      {/* Thumb is the elevated line surface, not bg-sheet (§4.1 amended
          2026-07-11): a sheet-colored thumb vanishes into the navy track. */}
      <div
        className={`absolute inset-y-0.75 left-0.75 w-[calc(50%-3px)] rounded-[5px] bg-line shadow-[0_1px_4px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.03)] transition-transform duration-180 ease-out motion-reduce:transition-none ${
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
            value === category ? "text-ink" : "text-muted"
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
