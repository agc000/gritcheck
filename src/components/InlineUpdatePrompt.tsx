"use client";

import { CheckPin } from "@/components/BrandMark";
import {
  OPEN_UPDATE_EVENT,
  type OpenUpdateEventDetail,
} from "@/lib/map-events";

// The detail view's "How's it right now?" (§4.2) — same UpdateSheet flow,
// pre-selected to this spot (no geolocation involved: the user is already
// looking at the place they mean). Gold: it IS the update action (§4.1).
export function InlineUpdatePrompt({ slug }: { slug: string }) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent<OpenUpdateEventDetail>(OPEN_UPDATE_EVENT, {
            detail: { slug },
          }),
        )
      }
      className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gold text-[15px] font-bold text-black transition-transform duration-150 ease-out active:scale-98 motion-reduce:transition-none"
    >
      <CheckPin className="h-4.5 w-4.5" color="currentColor" />
      How&rsquo;s it right now?
    </button>
  );
}
