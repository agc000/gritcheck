"use client";

// The Update FAB (§4.2): floating gold pill, bottom-right, riding above the
// sheet edge. This is the entry point to the §1.2 reciprocity loop, so it is
// deliberately the loudest element on screen: the only pill in the app
// (chips/sort were de-pilled 2026-07-10 — its uniqueness IS the hierarchy)
// and one of the four sanctioned gold signals (§4.1).
//
// Phase 4 wires onClick to the UpdateSheet flow; until then it renders the
// chrome so the home screen composition is honest to the final layout.
export function UpdateButton() {
  return (
    <button
      type="button"
      aria-label="Post an update"
      // data-vaul-no-drag: a slightly-sliding tap on the button must never
      // turn into a sheet drag.
      data-vaul-no-drag
      // Phase 4: open the UpdateSheet flow.
      className="absolute -top-15 right-[max(1rem,env(safe-area-inset-right))] flex h-12 items-center gap-2 rounded-full bg-gold px-5 text-[15px] font-bold text-black shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-transform duration-150 ease-out active:scale-97 motion-reduce:transition-none"
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      >
        <path d="M10 3.5v13M3.5 10h13" />
      </svg>
      Update
    </button>
  );
}
