"use client";

// Food | Study | Find Building segmented control (§4.2; third tab added
// 2026-07-25, Alan) — structure from DESIGN_REFERENCE.html `.modes` (soft
// track, sliding thumb); colors follow §4.1 as amended 2026-07-11 (navy
// palette), which supersedes the mockup's white thumb. Generic over its
// options so the tab roster lives with the browse state, not here. Text is
// 13.5px (was 14.5 at two tabs): "Find Building" must fit a third of a
// 375px-wide sheet without truncating.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div role="tablist" className="relative flex rounded-control bg-soft p-0.75">
      {/* Thumb is the elevated line surface, not bg-sheet (§4.1 amended
          2026-07-11): a sheet-colored thumb vanishes into the navy track.
          Sized to one segment; translateX in multiples of its own width
          lands it on the active one. */}
      <div
        className="absolute inset-y-0.75 left-0.75 rounded-[5px] bg-line shadow-[0_1px_4px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.03)] transition-transform duration-180 ease-out motion-reduce:transition-none"
        style={{
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`relative z-1 flex-1 rounded-[5px] py-2.5 text-[13.5px] font-bold transition-[color,transform] duration-150 ease-out active:scale-97 before:absolute before:inset-x-0 before:-inset-y-0.5 motion-reduce:transition-none ${
            value === opt.value ? "text-ink" : "text-muted"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
