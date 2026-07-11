"use client";

import { useState } from "react";
import { Drawer } from "vaul";

// §4.2: snap points at ~15% (peek), ~55% (default), ~90% (full). vaul is the
// maintained sheet library the plan mandates — it owns the drag physics
// (momentum, rubber-banding) so we never hand-roll them.
const SNAP_PEEK = 0.15;
const SNAP_DEFAULT = 0.55;
const SNAP_FULL = 0.9;

export function Sheet({ children }: { children: React.ReactNode }) {
  const [snap, setSnap] = useState<number | string | null>(SNAP_DEFAULT);

  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      snapPoints={[SNAP_PEEK, SNAP_DEFAULT, SNAP_FULL]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-10 flex h-full max-h-[97%] flex-col rounded-t-sheet bg-sheet text-ink outline-none"
          aria-describedby={undefined}
        >
          <Drawer.Title className="sr-only">Campus spots</Drawer.Title>
          {/* Grabber bar — the drag affordance. */}
          <div className="mx-auto mt-2.5 mb-1.5 h-1 w-9 shrink-0 rounded-full bg-line" />
          {/* Scroll the list at the default AND full snaps — only lock it at
              the peek sliver, where the gesture should expand the sheet, not
              scroll. vaul hands off drag-vs-scroll by scroll position. */}
          {/* overscroll-none keeps iOS rubber-band scrolling from fighting
              the drawer's own drag physics (phone-gate stutter report). */}
          <div
            className={`min-h-0 flex-1 overscroll-none ${snap === SNAP_PEEK ? "overflow-hidden" : "overflow-y-auto"}`}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
