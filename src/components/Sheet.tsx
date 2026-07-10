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
          <div
            className={`min-h-0 flex-1 ${snap === SNAP_FULL ? "overflow-y-auto" : "overflow-hidden"}`}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
