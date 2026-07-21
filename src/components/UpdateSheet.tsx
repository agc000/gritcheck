"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Drawer } from "vaul";

import { CheckPin } from "@/components/BrandMark";
import { getDeviceId } from "@/lib/device";
import { logEvent } from "@/lib/events";
import {
  OPEN_UPDATE_EVENT,
  type OpenUpdateEventDetail,
} from "@/lib/map-events";
import { supabase } from "@/lib/supabase";
import type { SpotListItem } from "@/lib/types";

// The §4.2 update flow: ≤3 taps. (1) geolocation pre-selects the nearest
// open spot — with a change-spot escape hatch; (2) one gesture per field,
// huge targets; (3) send, subtle confirmation, dismiss. Location is
// requested at first benefit — the moment the user taps Update — never on
// load (§13.2), and is used in-memory only.
//
// This is its OWN vaul drawer, deliberately configured opposite to the
// persistent browse Sheet: modal (overlay, focus trap) and dismissible
// (swipe-down/overlay-tap cancels). It portals to <body>, so it can mount at
// page level without touching the browse sheet's twin/drawer architecture.

type Step = "locating" | "picking" | "form";

// Equirectangular approximation — exact enough across one campus, and it
// keeps trig out of a comparison-only path.
function nearestSpot(
  items: SpotListItem[],
  lat: number,
  lng: number,
): SpotListItem | null {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let best: SpotListItem | null = null;
  let bestD = Infinity;
  for (const item of items) {
    const dx = (item.lng - lng) * cosLat;
    const dy = item.lat - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

// 1–10 scales (§3.1/§4.3 amendments 2026-07-17): drag a slider along the
// green→red gradient. All three measured fields (line, crowd, noise) use
// the same control — consistency was the explicit ask. The readout number
// wears the §4.3 band color (1–3 go, 4–6 hold, 7–10 skip). Starts untouched
// (neutral thumb, "—") so Send stays disabled until the user actually rates.
const SCALE_BAND = (n: number) =>
  n <= 3 ? ("go" as const) : n <= 6 ? ("hold" as const) : ("skip" as const);
const BAND_TEXT = { go: "text-go", hold: "text-hold", skip: "text-skip" };

function ScaleRow({
  label,
  lowHint,
  highHint,
  value,
  onChange,
}: {
  label: string;
  lowHint: string;
  highHint: string;
  value: number | null;
  onChange: (next: number) => void;
}) {
  const band = value === null ? null : SCALE_BAND(value);
  return (
    // data-vaul-no-drag: a horizontal slider drag with slight vertical drift
    // must never turn into a sheet drag (vaul scar tissue).
    <div data-vaul-no-drag>
      <div className="flex items-baseline justify-between">
        <p className="mb-1.5 text-[12.5px] font-semibold text-muted">{label}</p>
        <span
          aria-hidden
          className={`font-mono text-[17px] font-bold ${band ? BAND_TEXT[band] : "text-faint"}`}
        >
          {value ?? "—"}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value ?? 5}
        aria-label={`${label}, 1 (${lowHint}) to 10 (${highHint})`}
        // VoiceOver reads meaning, not just a number: "8, toward out the
        // door" instead of "8".
        aria-valuetext={
          value === null
            ? "not set"
            : `${value}, ${value <= 3 ? `toward ${lowHint}` : value <= 6 ? "in between" : `toward ${highHint}`}`
        }
        onChange={(e) => onChange(Number(e.target.value))}
        // vaul's Content pointer handlers capture the stream and eat the
        // native drag (observed: value frozen, drawer dismissing mid-slide).
        // Stopping propagation here keeps the gesture the input's own;
        // data-vaul-no-drag alone was not enough.
        onPointerDown={(e) => e.stopPropagation()}
        // A tap that lands exactly on the resting value fires no change
        // event — commit the untouched → rated transition on release too.
        onPointerUp={(e) => {
          if (value === null) onChange(Number(e.currentTarget.value));
        }}
        className={`line-slider w-full ${value === null ? "line-slider-unset" : ""}`}
      />
      <div className="mt-1 flex justify-between text-[11px] text-faint">
        <span>1 · {lowHint}</span>
        <span>10 · {highHint}</span>
      </div>
    </div>
  );
}

// One-tap-per-field button row (worth-it stays a genuine binary). Selected
// state borrows the sanctioned active-filter gold (FilterChips idiom).
function FieldRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; word: string }>;
  value: T | null;
  onChange: (next: T) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-semibold text-muted">{label}</p>
      <div className="flex gap-2" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`h-12 flex-1 rounded-md border text-[14px] font-semibold transition-colors duration-150 motion-reduce:transition-none ${
              value === opt.value
                ? "border-black bg-black text-gold"
                : "border-line bg-soft text-ink"
            }`}
          >
            {opt.word}
          </button>
        ))}
      </div>
    </div>
  );
}

export function UpdateSheet({ items }: { items: SpotListItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("locating");
  const [spot, setSpot] = useState<SpotListItem | null>(null);
  // "You're near X" is only honest when location chose X.
  const [located, setLocated] = useState(false);
  // Non-null while the picker is scoped to one building's zones: GPS can
  // place you AT a building but never on a floor — pretending otherwise is
  // what made "I'm in the Atrium" preselect a different AOK zone (Alan's
  // report). Scoped picking asks instead of guessing.
  const [pickScope, setPickScope] = useState<string | null>(null);

  const [line, setLine] = useState<number | null>(null);
  const [worthIt, setWorthIt] = useState<boolean | null>(null);
  const [crowd, setCrowd] = useState<number | null>(null);
  const [noise, setNoise] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The list can be stale-props by the time the event fires; a ref keeps the
  // open-handler effect subscribe-once without closing over items.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenUpdateEventDetail>).detail;
      // Reset the whole flow — every open is a fresh report.
      setLine(null);
      setWorthIt(null);
      setCrowd(null);
      setNoise(null);
      setComment("");
      setSending(false);
      setSent(false);
      setError(null);
      setLocated(false);
      setPickScope(null);
      setOpen(true);

      const preset = detail?.slug
        ? itemsRef.current.find((i) => i.slug === detail.slug)
        : undefined;
      if (preset) {
        setSpot(preset);
        setStep("form");
        return;
      }
      setSpot(null);
      if (!navigator.geolocation) {
        setStep("picking");
        return;
      }
      setStep("locating");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Pre-select against OPEN spots — reporting a line at a closed
          // one is nonsense; the picker still offers everything.
          const openItems = itemsRef.current.filter((i) => i.isOpen);
          const pool = openItems.length ? openItems : itemsRef.current;
          const near = nearestSpot(
            pool,
            pos.coords.latitude,
            pos.coords.longitude,
          );
          if (!near) {
            setStep("picking");
            return;
          }
          // Same building, several zones (AOK's five floors): GPS cannot
          // pick the floor, so ask — scoped to that building.
          const siblings = pool.filter((i) => i.building === near.building);
          if (siblings.length > 1) {
            setLocated(true);
            setPickScope(near.building);
            setStep("picking");
          } else {
            setSpot(near);
            setLocated(true);
            setStep("form");
          }
        },
        // Denied or unavailable → picker, no nagging (§13.2).
        () => setStep("picking"),
        { maximumAge: 60_000, timeout: 4_000 },
      );
    };
    window.addEventListener(OPEN_UPDATE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_UPDATE_EVENT, onOpen);
  }, []);

  const hasSignal =
    spot?.category === "food"
      ? line !== null || worthIt !== null
      : crowd !== null || noise !== null;

  const send = async () => {
    if (!spot || !hasSignal || sending) return;
    setSending(true);
    setError(null);
    const trimmed = comment.trim();
    const { error: fnError } = await supabase.functions.invoke(
      "submit-update",
      {
        body: {
          spot_id: spot.id,
          device_id: getDeviceId(),
          kind: spot.category,
          ...(spot.category === "food"
            ? { ...(line && { line }), ...(worthIt !== null && { worth_it: worthIt }) }
            : { ...(crowd && { crowd }), ...(noise && { noise }) }),
          ...(trimmed && { comment: trimmed.slice(0, 80) }),
        },
      },
    );
    if (fnError) {
      // Server copy is already §4.7-dry (rate-limit lines etc.); surface it.
      const body =
        fnError instanceof FunctionsHttpError
          ? await fnError.context.json().catch(() => null)
          : null;
      setError(body?.error ?? "Couldn't send. Try again.");
      setSending(false);
      return;
    }
    // Subtle confirmation, then dismiss (§4.2 step 3) and pull fresh
    // verdicts into the browse list; Realtime covers other clients.
    logEvent("submit_update", { slug: spot.slug, kind: spot.category });
    setSent(true);
    setTimeout(() => {
      setOpen(false);
      router.refresh();
    }, 700);
  };

  // Open spots first; closed still selectable — hours data has known gaps
  // and hiding rows would strand honest reporters. A building scope narrows
  // the list to that building's zones.
  const pickList = [...items]
    .filter((i) => !pickScope || i.building === pickScope)
    .sort(
      (a, b) =>
        Number(b.isOpen) - Number(a.isOpen) || a.name.localeCompare(b.name),
    );

  const pickSpot = (item: SpotListItem) => {
    // A different spot voids tapped signals (they were about the old spot)
    // and any stale server error; typed comments survive — retyping costs
    // more than re-tapping.
    if (item.slug !== spot?.slug) {
      setLine(null);
      setWorthIt(null);
      setCrowd(null);
      setNoise(null);
      setError(null);
    }
    setSpot(item);
    setStep("form");
  };

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-20 bg-black/50" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-30 flex max-h-[85%] flex-col rounded-t-sheet bg-sheet pb-[max(1rem,env(safe-area-inset-bottom))] text-ink outline-none"
        >
          <div className="mx-auto mt-2.5 mb-1.5 h-1 w-9 shrink-0 rounded-full bg-line" />
          {/* The Check-Pin heads every update surface (Alan, 2026-07-17):
              the mark should mean "report what you see". Gold on navy per
              the §4.1 logo system. */}
          <CheckPin className="mx-auto mb-1 h-6 w-6 shrink-0" />

          {sent ? (
            <div className="px-5 py-9 text-center">
              <p className="text-[15px] font-bold">Sent.</p>
              <p className="mt-1 text-[12.5px] text-muted">
                Verdicts update as reports come in.
              </p>
            </div>
          ) : step === "locating" ? (
            <div className="px-5 py-9 text-center">
              <Drawer.Title className="text-[15px] font-bold">
                Finding the nearest spot…
              </Drawer.Title>
              <button
                type="button"
                onClick={() => {
                  setPickScope(null);
                  setLocated(false);
                  setStep("picking");
                }}
                className="mt-3 h-11 rounded-md px-4 text-[12.5px] font-semibold text-muted"
              >
                Pick it myself
              </button>
            </div>
          ) : step === "picking" ? (
            <>
              <Drawer.Title className="px-5 pt-1 pb-2 text-[15px] font-bold">
                {pickScope
                  ? `You're at ${pickScope} — which one?`
                  : "Which spot?"}
              </Drawer.Title>
              <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-none px-1">
                {pickList.map((item) => (
                  <li key={item.slug}>
                    <button
                      type="button"
                      onClick={() => pickSpot(item)}
                      className="flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold">
                          {item.name}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          {item.building}
                        </span>
                      </span>
                      {!item.isOpen && (
                        <span className="shrink-0 text-[12px] font-semibold text-closed">
                          Closed
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {pickScope && (
                <button
                  type="button"
                  onClick={() => {
                    setPickScope(null);
                    setLocated(false);
                  }}
                  className="mx-5 mt-1 h-11 shrink-0 text-[12.5px] font-semibold text-muted"
                >
                  Somewhere else
                </button>
              )}
            </>
          ) : spot ? (
            <div className="flex flex-col gap-4 px-5 pt-1">
              <div className="flex items-baseline justify-between gap-3">
                <Drawer.Title className="min-w-0 text-[15px] font-bold">
                  {located
                    ? `You're near ${spot.name} — how's it looking?`
                    : `${spot.name} — how's it looking?`}
                </Drawer.Title>
                {/* Detail pages mount the flow with a single preset spot —
                    no picker to escape to. */}
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPickScope(null);
                      setLocated(false);
                      setStep("picking");
                    }}
                    className="h-11 shrink-0 text-[12.5px] font-semibold text-muted"
                  >
                    Change spot
                  </button>
                )}
              </div>

              {spot.category === "food" ? (
                <>
                  <ScaleRow
                    label="Line"
                    lowHint="walk right up"
                    highHint="out the door"
                    value={line}
                    onChange={setLine}
                  />
                  <FieldRow
                    label="Worth the trip?"
                    options={[
                      { value: "yes", word: "Yes" },
                      { value: "no", word: "No" },
                    ]}
                    value={worthIt === null ? null : worthIt ? "yes" : "no"}
                    onChange={(v) =>
                      setWorthIt(
                        (v === "yes") === worthIt ? null : v === "yes",
                      )
                    }
                  />
                </>
              ) : (
                <>
                  <ScaleRow
                    label="Crowd"
                    lowHint="empty"
                    highHint="packed"
                    value={crowd}
                    onChange={setCrowd}
                  />
                  <ScaleRow
                    label="Noise"
                    lowHint="silent"
                    highHint="loud"
                    value={noise}
                    onChange={setNoise}
                  />
                </>
              )}

              {/* Visible, never required, never focused by default (§4.2). */}
              <input
                type="text"
                value={comment}
                maxLength={80}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note (optional)"
                // placeholder is --muted, not --faint: faint on the soft input
                // fill is 4.36:1, under the §4.8 4.5 floor; muted is 6.07:1
                // and still clearly recessive against entered --ink text.
                className="h-11 rounded-md border border-line bg-soft px-3 text-[14px] text-ink placeholder:text-muted focus:outline-none"
              />

              {error && <p className="text-[12.5px] text-skip">{error}</p>}

              <button
                type="button"
                disabled={!hasSignal || sending}
                onClick={send}
                className="h-12 rounded-md bg-gold text-[15px] font-bold text-black transition-transform duration-150 ease-out active:scale-98 disabled:opacity-40 motion-reduce:transition-none"
              >
                {sending ? "Sending…" : "Send update"}
              </button>
            </div>
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
