"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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

// Never fires — useSyncExternalStore only needs the server/client snapshots
// to answer "has hydration happened", no subscription involved.
const emptySubscribe = () => () => {};

export function Sheet({ children }: { children: React.ReactNode }) {
  const [snap, setSnap] = useState<number | string | null>(SNAP_DEFAULT);
  // SSR strategy (PSI audit 2026-07-13): vaul/Radix only render drawer
  // content client-side (portal or not), which kept the entire sheet out of
  // the server HTML — on a mid phone the product's answer painted at ~5.7s
  // (LCP), after hydration. So the server paints a static twin panel at the
  // default-snap position, and the real drawer replaces it in place on
  // mount. Identical geometry and classes → no jump, no CLS; the swap is
  // exactly the moment interactivity exists anyway.
  // "Hydrated yet?" without an effect (react-hooks/set-state-in-effect is a
  // CI error): server snapshot false → SSR renders the twin; client snapshot
  // true → drawer takes over right at hydration.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  // The twin outlives the drawer mount by ~700ms: vaul paints its content
  // offscreen and slides it up via compositor transform (which never
  // repaints, so LCP would otherwise lose the sheet entirely), and without
  // the overlap the screen goes sheet-less during the slide. Sliding over
  // identical pixels makes the handoff invisible. (setState inside the
  // timeout callback is async — not the synchronous-in-effect pattern the
  // lint rule bans.)
  const [twinGone, setTwinGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTwinGone(true), 700);
    return () => clearTimeout(t);
  }, []);

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

  // Shared sheet chrome: FAB + recenter + grabber + scrollable list. Used by
  // both the SSR twin and the live drawer so they can never drift apart.
  const inner = (
    <>
      {/* Inside the sheet so it rides the edge through every snap and drag —
          §4.2 "riding above the sheet edge". */}
      <UpdateButton />
      {/* Recenter: utility control, so ink-on-dark, not gold (§4.1 — gold is
          signal only). Mirrors the FAB on the left edge. */}
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
      {/* Grabber. The visible bar stays 4px (§4.2 restraint), but the DRAG
          TARGET is this whole strip — a 4px-tall handle is unhittable with a
          thumb, which is a large part of why pulling the sheet down felt
          finicky. touch-action:none matters more than the size: without it
          iOS can claim the gesture as a native scroll before vaul's
          pointermove ever runs, and once the browser owns a touch, JS cannot
          take it back mid-gesture — the drag then either stalls or turns into
          page overscroll. Outside the scroll container, so it drags at any
          scroll position. */}
      <div className="shrink-0 touch-none pt-2.5 pb-2.5" aria-hidden>
        <div className="mx-auto h-1 w-9 rounded-full bg-line" />
      </div>
      {/* Scroll the list at the default AND full snaps — only lock it at the
          peek sliver, where the gesture should expand the sheet, not scroll. */}
      {/* overscroll-none keeps iOS rubber-band scrolling from fighting the
          drawer's own drag physics (phone-gate stutter report). */}
      {/* data-vaul-no-drag while scrolled: below the full snap the sheet has
          translateY > 0, and vaul's shouldDrag short-circuits on that BEFORE
          checking scrollTop — so a mid-list swipe would drag the whole sheet
          (Alan's phone repro). The attribute is vaul's own opt-out; toggled
          directly on the node. At scrollTop 0 it comes off, so
          drag-to-collapse still works. */}
      <div
        onScroll={(e: UIEvent<HTMLDivElement>) => {
          const el = e.currentTarget;
          el.toggleAttribute("data-vaul-no-drag", el.scrollTop > 0);
        }}
        className={`min-h-0 flex-1 overscroll-none ${snap === SNAP_PEEK ? "overflow-hidden" : "overflow-y-auto"}`}
      >
        {children}
      </div>
    </>
  );

  const sheetClasses =
    "fixed inset-x-0 bottom-0 z-10 flex h-full max-h-[97%] flex-col rounded-t-sheet bg-sheet text-ink outline-none";
  // Twin positions with top/bottom, NOT a transform: transform-positioned
  // fixed elements failed to rasterize in headless/software-GL renderers
  // (laid out + hit-testable but zero pixels — and Lighthouse runs the same
  // renderer, so the twin was invisible to LCP). top-[48%] lands the sheet
  // edge exactly where the drawer's default snap does.
  const twinClasses =
    "fixed inset-x-0 top-[48%] bottom-0 z-10 flex flex-col rounded-t-sheet bg-sheet text-ink";

  if (!mounted) {
    // Server-painted twin at the default 55% snap (translate-y 45%). This is
    // what the user sees at FCP and what PSI measures as LCP.
    return (
      <div className={twinClasses}>{inner}</div>
    );
  }

  return (
    <>
      {/* Twin persists under the drawer for the slide-in (see twinGone note
          above), then unmounts. aria-hidden: the drawer is the real one now. */}
      {!twinGone && (
        <div aria-hidden className={twinClasses}>
          {inner}
        </div>
      )}
      <Drawer.Root
      open
      modal={false}
      dismissible={false}
      snapPoints={[SNAP_PEEK, SNAP_DEFAULT, SNAP_FULL]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      // Lowered 500 → 250 (Alan's swipe-down lag report 2026-07-24). 500ms
      // was set when this was the ONLY guard against a post-fling swipe
      // collapsing the snap; the data-vaul-no-drag toggle below now guards
      // that precisely (you can only drag at scrollTop 0), so the timeout is
      // just a blunt second lock — and every ms of it is dead time where a
      // deliberate pull-down does nothing, which is what "laggy" was. 250ms
      // still absorbs the tail of a fling.
      // FEEL-CHECK KNOB: if a fling ever collapses the sheet again, raise
      // this first — it is the one number governing that tradeoff.
      scrollLockTimeout={250}
    >
      <Drawer.Portal>
        <Drawer.Content className={sheetClasses} aria-describedby={undefined}>
          <Drawer.Title className="sr-only">Campus spots</Drawer.Title>
          {inner}
        </Drawer.Content>
      </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
