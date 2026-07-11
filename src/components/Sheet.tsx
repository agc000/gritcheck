"use client";

import { useEffect, useState } from "react";
import type { UIEvent } from "react";
import { Drawer } from "vaul";

import { EXPAND_SHEET_EVENT, RECENTER_EVENT } from "@/lib/map-events";
import { UpdateButton } from "./UpdateButton";

// §4.2: snap points at ~15% (peek), ~55% (default), ~90% (full). vaul is the
// maintained sheet library the plan mandates — it owns the drag physics
// (momentum, rubber-banding) so we never hand-roll them.
const SNAP_PEEK = 0.15;
const SNAP_DEFAULT = 0.55;
const SNAP_FULL = 0.9;

export function Sheet({ children }: { children: React.ReactNode }) {
  const [snap, setSnap] = useState<number | string | null>(SNAP_DEFAULT);

  // Tapping the visible map collapses the sheet to the peek sliver: "show me
  // the map" gets a dedicated one-tap gesture instead of competing with list
  // scrolling for the drag gesture (Alan's two-swipes-to-map report). A
  // document listener because the map lives outside this tree; drag-pans on
  // the map don't emit click, so panning never collapses the sheet. Phase 3
  // building/marker taps must take precedence when they land (open the spot,
  // not just collapse).
  useEffect(() => {
    const onMapTap = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest(".maplibregl-canvas")) setSnap(SNAP_PEEK);
    };
    document.addEventListener("click", onMapTap);
    // Multi-spot building tap (MapView) raises the sheet to browse that
    // building's spots. MapView stops propagation on those taps, so the
    // collapse listener above never fights this.
    const onExpand = () => setSnap(SNAP_DEFAULT);
    window.addEventListener(EXPAND_SHEET_EVENT, onExpand);
    return () => {
      document.removeEventListener("click", onMapTap);
      window.removeEventListener(EXPAND_SHEET_EVENT, onExpand);
    };
  }, []);

  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      snapPoints={[SNAP_PEEK, SNAP_DEFAULT, SNAP_FULL]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      // vaul's default is 100ms: a fast swipe right after a scroll fling gets
      // reinterpreted as a sheet drag and collapses the snap (Alan's phone
      // report). 500ms keeps consecutive scroll swipes as scrolls; a deliberate
      // pause-then-drag still moves the sheet.
      scrollLockTimeout={500}
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-10 flex h-full max-h-[97%] flex-col rounded-t-sheet bg-sheet text-ink outline-none"
          aria-describedby={undefined}
        >
          <Drawer.Title className="sr-only">Campus spots</Drawer.Title>
          {/* Inside Drawer.Content so it rides the sheet edge through every
              snap and drag — §4.2 "riding above the sheet edge". */}
          <UpdateButton />
          {/* Recenter: utility control, so ink-on-dark, not gold (§4.1 —
              gold is signal only). Mirrors the FAB on the left edge. */}
          <button
            type="button"
            aria-label="Recenter map on campus"
            data-vaul-no-drag
            onClick={() => window.dispatchEvent(new CustomEvent(RECENTER_EVENT))}
            className="absolute -top-15 left-[max(1rem,env(safe-area-inset-left))] flex h-11 w-11 items-center justify-center rounded-full bg-black/80 text-ink shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-transform duration-150 ease-out active:scale-97 motion-reduce:transition-none"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-4.5 w-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="6.5" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
              <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" strokeLinecap="round" />
            </svg>
          </button>
          {/* Grabber bar — the drag affordance. */}
          <div className="mx-auto mt-2.5 mb-1.5 h-1 w-9 shrink-0 rounded-full bg-line" />
          {/* Scroll the list at the default AND full snaps — only lock it at
              the peek sliver, where the gesture should expand the sheet, not
              scroll. vaul hands off drag-vs-scroll by scroll position. */}
          {/* overscroll-none keeps iOS rubber-band scrolling from fighting
              the drawer's own drag physics (phone-gate stutter report). */}
          {/* data-vaul-no-drag while scrolled: below the full snap the sheet
              has translateY > 0, and vaul's shouldDrag short-circuits on that
              BEFORE checking scrollTop — so a mid-list swipe would drag the
              whole sheet (Alan's phone repro: scroll to bottom, swipe down,
              sheet collapses). The attribute is vaul's own opt-out; toggled
              directly on the node (no re-render per scroll frame). At
              scrollTop 0 it comes off, so drag-to-collapse still works. */}
          <div
            onScroll={(e: UIEvent<HTMLDivElement>) => {
              const el = e.currentTarget;
              el.toggleAttribute("data-vaul-no-drag", el.scrollTop > 0);
            }}
            className={`min-h-0 flex-1 overscroll-none ${snap === SNAP_PEEK ? "overflow-hidden" : "overflow-y-auto"}`}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
