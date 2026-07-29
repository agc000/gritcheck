"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer } from "vaul";

import {
  COLLAPSE_SHEET_EVENT,
  FIND_BUILDING_EVENT,
  OPEN_FIND_EVENT,
  SELECT_BUILDING_EVENT,
  setPendingFind,
  type FindBuildingEventDetail,
  type SelectBuildingEventDetail,
} from "@/lib/map-events";
import type { BuildingMarker } from "./MapView";

// Find-a-building (Alan, 2026-07-24 — the freshman's "where is ITE?").
// Modal vaul drawer, same physics as UpdateSheet. The index merges the 5
// interactive spot buildings with the 71 OSM label points (fetched on first
// open — 8 KB, never on the critical path). Picking one collapses the browse
// sheet and hands the map a target; MapView does the camera + pulse.

type Entry = FindBuildingEventDetail;

const RESULT_LIMIT = 8;

export function FindSheet({ buildings }: { buildings: BuildingMarker[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [labels, setLabels] = useState<Entry[] | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setQuery("");
      setOpen(true);
    };
    window.addEventListener(OPEN_FIND_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_FIND_EVENT, onOpen);
  }, []);

  // Load the label index the first time the drawer opens.
  useEffect(() => {
    if (!open || labels !== null) return;
    let cancelled = false;
    fetch("/campus-labels.geojson")
      .then((r) => r.json())
      .then((fc: GeoJSON.FeatureCollection) => {
        if (cancelled) return;
        setLabels(
          fc.features.flatMap((f) =>
            f.geometry.type === "Point"
              ? [
                  {
                    name: String(f.properties?.name ?? ""),
                    lng: f.geometry.coordinates[0],
                    lat: f.geometry.coordinates[1],
                  },
                ]
              : [],
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setLabels([]); // interactive buildings still searchable
      });
    return () => {
      cancelled = true;
    };
  }, [open, labels]);

  const index = useMemo<Entry[]>(() => {
    const interactive: Entry[] = buildings.map((b) => ({
      name: b.building,
      lng: b.lng,
      lat: b.lat,
      buildingKey: b.building,
    }));
    const seen = new Set(interactive.map((e) => e.name.toLowerCase()));
    return [
      ...interactive,
      ...(labels ?? []).filter((l) => !seen.has(l.name.toLowerCase())),
    ];
  }, [buildings, labels]);

  const q = query.trim().toLowerCase();
  const results =
    q.length === 0
      ? []
      : index
          .filter((e) => e.name.toLowerCase().includes(q))
          // Prefix matches first, then alphabetical — "co" puts Commons
          // above Chincoteague's "-co-".
          .sort((a, b) => {
            const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
            const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
            return ap - bp || a.name.localeCompare(b.name);
          })
          .slice(0, RESULT_LIMIT);

  const pick = (e: Entry) => {
    setOpen(false);
    // Map may not be mounted yet (gesture gate) — park the target where
    // MapView's setup can drain it, then broadcast for the mounted case.
    setPendingFind(e);
    window.dispatchEvent(
      new CustomEvent<FindBuildingEventDetail>(FIND_BUILDING_EVENT, {
        detail: e,
      }),
    );
    // Drop the browse sheet to the peek sliver so the map is actually
    // visible when the camera lands.
    window.dispatchEvent(new CustomEvent(COLLAPSE_SHEET_EVENT));
    // Interactive building → also scope the list to it, same as tapping it.
    if (e.buildingKey) {
      window.dispatchEvent(
        new CustomEvent<SelectBuildingEventDetail>(SELECT_BUILDING_EVENT, {
          detail: { building: e.buildingKey },
        }),
      );
    }
  };

  // Gold on the matched substring — the §4.1 signal doing signal work.
  const highlight = (name: string) => {
    const i = name.toLowerCase().indexOf(q);
    if (i < 0) return name;
    return (
      <>
        {name.slice(0, i)}
        <span className="text-gold">{name.slice(i, i + q.length)}</span>
        {name.slice(i + q.length)}
      </>
    );
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
          <div className="px-5 pt-1">
            <Drawer.Title className="text-[15px] font-bold">
              Find a building
            </Drawer.Title>
            <input
              type="text"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name — ITE, Sherman, Patapsco…"
              className="mt-3 h-11 w-full rounded-md border border-line bg-soft px-3 text-[14px] text-ink placeholder:text-muted focus:outline-none"
            />
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-none px-1 pt-1">
            {results.map((e) => (
              <li key={e.name}>
                <button
                  type="button"
                  onClick={() => pick(e)}
                  className="w-full px-4 py-3 text-left text-[14px] font-semibold"
                >
                  {highlight(e.name)}
                </button>
              </li>
            ))}
            {q.length > 0 && results.length === 0 && (
              <li className="px-4 py-6 text-center text-[12.5px] text-muted">
                No building by that name.
              </li>
            )}
          </ul>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
