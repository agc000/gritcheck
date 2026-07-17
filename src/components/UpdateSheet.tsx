"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Drawer } from "vaul";

import { getDeviceId } from "@/lib/device";
import { logEvent } from "@/lib/events";
import {
  OPEN_UPDATE_EVENT,
  type OpenUpdateEventDetail,
} from "@/lib/map-events";
import { supabase } from "@/lib/supabase";
import type { SpotListItem } from "@/lib/types";

// The §4.2 update flow: ≤3 taps. (1) geolocation pre-selects the nearest
// open spot — with a change-spot escape hatch; (2) one tap per field, huge
// targets; (3) send, subtle confirmation, dismiss. Location is requested at
// first benefit — the moment the user taps Update — never on load (§13.2),
// and is used in-memory only.
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

// One-tap-per-field button row. Selected state borrows the sanctioned
// active-filter gold (FilterChips idiom: black fill, gold text).
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

  const [line, setLine] = useState<"short" | "normal" | "long" | null>(null);
  const [worthIt, setWorthIt] = useState<boolean | null>(null);
  const [crowd, setCrowd] = useState<"empty" | "normal" | "packed" | null>(null);
  const [noise, setNoise] = useState<"quiet" | "normal" | "loud" | null>(null);
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
          // Pre-select the nearest OPEN spot — reporting a line at a closed
          // one is nonsense; the picker still offers everything.
          const open = itemsRef.current.filter((i) => i.isOpen);
          const near = nearestSpot(
            open.length ? open : itemsRef.current,
            pos.coords.latitude,
            pos.coords.longitude,
          );
          if (near) {
            setSpot(near);
            setLocated(true);
            setStep("form");
          } else {
            setStep("picking");
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
  // and hiding rows would strand honest reporters.
  const pickList = [...items].sort(
    (a, b) => Number(b.isOpen) - Number(a.isOpen) || a.name.localeCompare(b.name),
  );

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-20 bg-black/50" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-30 flex max-h-[85%] flex-col rounded-t-sheet bg-sheet pb-[max(1rem,env(safe-area-inset-bottom))] text-ink outline-none"
        >
          <div className="mx-auto mt-2.5 mb-1.5 h-1 w-9 shrink-0 rounded-full bg-line" />

          {sent ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[15px] font-bold">Sent.</p>
              <p className="mt-1 text-[12.5px] text-muted">
                Verdicts update as reports come in.
              </p>
            </div>
          ) : step === "locating" ? (
            <div className="px-5 py-10 text-center">
              <Drawer.Title className="text-[15px] font-bold">
                Finding the nearest spot…
              </Drawer.Title>
              <button
                type="button"
                onClick={() => setStep("picking")}
                className="mt-3 h-11 rounded-md px-4 text-[12.5px] font-semibold text-muted"
              >
                Pick it myself
              </button>
            </div>
          ) : step === "picking" ? (
            <>
              <Drawer.Title className="px-5 pt-1 pb-2 text-[15px] font-bold">
                Which spot?
              </Drawer.Title>
              <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-none px-1">
                {pickList.map((item) => (
                  <li key={item.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        // A different spot voids tapped signals (they were
                        // about the old spot) and any stale server error;
                        // typed comments survive — retyping costs more than
                        // re-tapping.
                        if (item.slug !== spot?.slug) {
                          setLine(null);
                          setWorthIt(null);
                          setCrowd(null);
                          setNoise(null);
                          setError(null);
                        }
                        setSpot(item);
                        setLocated(false);
                        setStep("form");
                      }}
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
                    onClick={() => setStep("picking")}
                    className="h-11 shrink-0 text-[12.5px] font-semibold text-muted"
                  >
                    Change spot
                  </button>
                )}
              </div>

              {spot.category === "food" ? (
                <>
                  <FieldRow
                    label="Line"
                    options={[
                      { value: "short", word: "Short" },
                      { value: "normal", word: "Normal" },
                      { value: "long", word: "Long" },
                    ]}
                    value={line}
                    onChange={(v) => setLine(line === v ? null : v)}
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
                  <FieldRow
                    label="Crowd"
                    options={[
                      { value: "empty", word: "Empty" },
                      { value: "normal", word: "Normal" },
                      { value: "packed", word: "Packed" },
                    ]}
                    value={crowd}
                    onChange={(v) => setCrowd(crowd === v ? null : v)}
                  />
                  <FieldRow
                    label="Noise"
                    options={[
                      { value: "quiet", word: "Quiet" },
                      { value: "normal", word: "Normal" },
                      { value: "loud", word: "Loud" },
                    ]}
                    value={noise}
                    onChange={(v) => setNoise(noise === v ? null : v)}
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
                className="h-11 rounded-md border border-line bg-soft px-3 text-[14px] text-ink placeholder:text-faint focus:outline-none"
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
