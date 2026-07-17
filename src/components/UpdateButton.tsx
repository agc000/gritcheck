"use client";

import { CheckPin } from "@/components/BrandMark";
import { OPEN_UPDATE_EVENT } from "@/lib/map-events";

// The Update FAB (§4.2): floating gold pill, bottom-right, riding above the
// sheet edge. This is the entry point to the §1.2 reciprocity loop, so it is
// deliberately the loudest element on screen: the only pill in the app
// (chips/sort were de-pilled 2026-07-10 — its uniqueness IS the hierarchy)
// and one of the four sanctioned gold signals (§4.1).
//
// Dispatches OPEN_UPDATE_EVENT rather than owning the flow: the FAB renders
// in both the SSR twin and the live drawer, and the UpdateSheet listens once
// at page level.
export function UpdateButton() {
  return (
    <button
      type="button"
      aria-label="Post an update"
      // data-vaul-no-drag: a slightly-sliding tap on the button must never
      // turn into a sheet drag.
      data-vaul-no-drag
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_UPDATE_EVENT))}
      className="absolute -top-15 right-[max(1rem,env(safe-area-inset-right))] flex h-12 items-center gap-2 rounded-full bg-gold px-5 text-[15px] font-bold text-black shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-transform duration-150 ease-out active:scale-97 motion-reduce:transition-none"
    >
      {/* Check-Pin instead of a generic +: the mark should mean "report
          what you see" everywhere status can be updated (Alan, 2026-07-17).
          currentColor = the FAB's black, i.e. mark-on-light per §4.1. */}
      <CheckPin className="h-4.5 w-4.5" color="currentColor" />
      Update
    </button>
  );
}
