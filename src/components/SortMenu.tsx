"use client";

import { useEffect, useRef, useState } from "react";
import type { SortOption } from "@/lib/sort";

// Sort control (mockup `.sort-btn`/`.sort-menu`): soft pill showing the
// active sort; tap opens a dropdown. The gold-soft row marks the active
// option — gold as state signal (§4.1).
export function SortMenu({
  options,
  activeId,
  onChange,
}: {
  options: SortOption[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = options.find((o) => o.id === activeId) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-1.25 whitespace-nowrap rounded-md bg-soft px-3.25 py-2 text-xs font-bold text-ink transition-transform duration-150 ease-out active:scale-97 before:absolute before:inset-x-0 before:-inset-y-1.5 motion-reduce:transition-none"
      >
        <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M4 7h16M7 12h10M10 17h4" />
        </svg>
        {active.label}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-45 overflow-hidden rounded-card border border-line bg-sheet p-1.25 shadow-[0_12px_32px_rgba(0,0,0,0.14)]"
        >
          {options.map((option) => {
            const selected = option.id === activeId;
            return (
              <button
                key={option.id}
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-[5px] px-3 py-3 text-left text-[13.5px] font-semibold ${
                  selected ? "bg-gold-soft text-black" : "text-ink hover:bg-soft"
                }`}
              >
                {option.label}
                {selected && <span className="font-extrabold text-go">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
