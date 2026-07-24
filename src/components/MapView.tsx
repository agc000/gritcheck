"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// One marker per building (grouped server-side in page.tsx — the Commons
// holds ~10 vendors on one roof, so per-spot pins would stack illegibly).
import {
  CATEGORY_EVENT,
  EXPAND_SHEET_EVENT,
  RECENTER_EVENT,
  SELECT_BUILDING_EVENT,
  type CategoryEventDetail,
  type SelectBuildingEventDetail,
} from "@/lib/map-events";
import type { Category } from "@/lib/types";

export type BuildingMarker = {
  building: string;
  lat: number;
  lng: number;
  spots: number;
  slugs: string[];
  food: boolean;
  study: boolean;
  open: boolean;
  /** Best live tone among the building's spots per category (page.tsx). */
  foodTone: "go" | "hold" | "skip" | null;
  studyTone: "go" | "hold" | "skip" | null;
};

// Status colors (§4.1 tokens) — the only place they touch the map. Dot falls
// back to open-green/closed-gray when no live tone exists; the glow layer is
// filtered out entirely in that case.
const TONE_COLORS = [
  "go", "#2CB56E",
  "hold", "#D9952E",
  "skip", "#E25B47",
] as const;
const toneColor = (prop: "foodTone" | "studyTone") =>
  [
    "match",
    ["coalesce", ["get", prop], "none"],
    ...TONE_COLORS,
    ["case", ["==", ["get", "open"], true], "#2CB56E", "#8B93A4"],
  ] as maplibregl.ExpressionSpecification;
const hasTone = (prop: "foodTone" | "studyTone") =>
  ["!=", ["coalesce", ["get", prop], "none"], "none"] as const;

// Campus camera. Extents are PLACEHOLDER — Alan to confirm on the campus walk
// (§Phase 3 "Alan provides"). Bounds keep the map pinned to UMBC's core so it
// can never be panned to open ocean; center/zoom frame the academic row.
const CAMPUS_BOUNDS: maplibregl.LngLatBoundsLike = [
  [-76.7215, 39.2465], // SW  // PLACEHOLDER — Alan to confirm
  [-76.6995, 39.2625], // NE  // PLACEHOLDER — Alan to confirm
];
// Note: at the default zoom the viewport nearly spans CAMPUS_BOUNDS, so
// maxBounds effectively pins the center — retune bounds, not center, to
// change the default framing.
const CAMPUS_CENTER: [number, number] = [-76.7105, 39.2548]; // PLACEHOLDER
const CAMPUS_PITCH = 30; // fixed, non-interactive (§4.2, amended 2026-07-11)

export default function MapView({
  buildings,
}: {
  buildings: BuildingMarker[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const selectedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "/map-style.json",
      center: CAMPUS_CENTER,
      zoom: 14.6,
      minZoom: 14,
      maxZoom: 18,
      pitch: CAMPUS_PITCH,
      bearing: 0,
      maxBounds: CAMPUS_BOUNDS,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      renderWorldCopies: false,
    });
    mapRef.current = map;

    // Belt-and-suspenders: disable every rotation/pitch gesture so the authored
    // camera angle can never be knocked loose (§4.2 non-interactive pitch).
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.touchPitch.disable();
    map.keyboard.disableRotation();

    // OpenFreeMap/OSM attribution is required; keep it compact, bottom-right.
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    // The map lives behind a draggable sheet and mounts before the fixed
    // layout has settled, so MapLibre can measure a stale container size and
    // render into a stunted (black) canvas. Re-measure on load and whenever the
    // container actually changes size.
    // Keep the compact attribution collapsed to its ⓘ toggle: expanded, its
    // text block is the biggest paint on screen and stole LCP (PSI audit).
    // MapLibre re-expands it internally (add/resize paths), and event-order
    // fixes proved unreliable — so a MutationObserver strips the class the
    // moment anything re-adds it. The user's own ⓘ tap is honored (their
    // toggle wins for as long as they keep it open), which keeps the OSM
    // attribution requirement satisfied: one tap away, never suppressed.
    const attrib = map.getContainer().querySelector(".maplibregl-ctrl-attrib");
    let userToggledAt = 0;
    attrib
      ?.querySelector(".maplibregl-ctrl-attrib-button")
      ?.addEventListener("click", () => {
        userToggledAt = Date.now();
      }, true);
    const attribGuard = new MutationObserver(() => {
      if (
        attrib &&
        Date.now() - userToggledAt > 1000 &&
        attrib.classList.contains("maplibregl-compact-show")
      ) {
        attrib.classList.remove("maplibregl-compact-show");
      }
    });
    if (attrib) {
      attrib.classList.remove("maplibregl-compact-show");
      attribGuard.observe(attrib, { attributes: true, attributeFilter: ["class"] });
    }

    map.once("load", () => {
      map.resize();
      setStyleLoaded(true);
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      attribGuard.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Data layers over the hand-authored base style, added in one effect so the
  // z-order is deterministic: extruded hero buildings → dots → labels.
  // Neutral fills only — gold appears solely on the selected building (§4.1's
  // sanctioned "selected building" signal); status glow arrives in Phase 4.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: buildings.map((b) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [b.lng, b.lat] },
        properties: {
          building: b.building,
          spots: b.spots,
          food: b.food,
          study: b.study,
          open: b.open,
          foodTone: b.foodTone,
          studyTone: b.studyTone,
        },
      })),
    };

    const source = map.getSource("spot-buildings") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData(data);
      return;
    }

    // Hero buildings: curated OSM footprints of the spot-buildings
    // (public/campus-buildings.geojson), extruded so the fixed 30° pitch
    // (§4.2 amendment) reads as dimensional. promoteId lets feature-state
    // key off the building name.
    map.addSource("campus-buildings", {
      type: "geojson",
      data: "/campus-buildings.geojson",
      promoteId: "key",
    });
    map.addLayer({
      id: "campus-buildings-fill",
      type: "fill-extrusion",
      source: "campus-buildings",
      paint: {
        "fill-extrusion-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#FFC20E",
          ["boolean", ["feature-state", "active"], true],
          "#3B372C",
          "#2B2820",
        ],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-opacity": 0.95,
      },
    });

    const clearSelection = () => {
      if (selectedKeyRef.current) {
        map.setFeatureState(
          { source: "campus-buildings", id: selectedKeyRef.current },
          { selected: false },
        );
        selectedKeyRef.current = null;
      }
    };

    // Building tap: gold-select the footprint, then route — one spot goes
    // straight to its detail; multi-spot buildings raise the sheet to browse.
    // stopPropagation keeps the Sheet's map-tap-collapse listener out of it.
    map.on("click", "campus-buildings-fill", (e) => {
      e.originalEvent.stopPropagation();
      const feature = e.features?.[0];
      const key = feature?.properties?.key as string | undefined;
      if (!key) return;
      clearSelection();
      map.setFeatureState(
        { source: "campus-buildings", id: key },
        { selected: true },
      );
      selectedKeyRef.current = key;
      const marker = buildings.find((b) => b.building === key);
      if (!marker) return;
      // EVERY building behaves the same (Alan, 2026-07-24): scope the list to
      // it and raise the sheet. Single-spot buildings (True Grit's, Admin)
      // used to jump straight to the detail page, which made a tap mean two
      // different things depending on data the user can't see — and yanked
      // them off the map for what should be a glance.
      window.dispatchEvent(
        new CustomEvent<SelectBuildingEventDetail>(SELECT_BUILDING_EVENT, {
          detail: { building: key },
        }),
      );
      window.dispatchEvent(new CustomEvent(EXPAND_SHEET_EVENT));
    });

    // Tap on empty map: drop any gold selection AND the list scope that
    // mirrors it (the sheet collapse for the same tap is Sheet's listener).
    map.on("click", (e) => {
      const hits = map.queryRenderedFeatures(e.point, {
        layers: ["campus-buildings-fill"],
      });
      if (hits.length === 0) {
        clearSelection();
        window.dispatchEvent(
          new CustomEvent<SelectBuildingEventDetail>(SELECT_BUILDING_EVENT, {
            detail: { building: null },
          }),
        );
      }
    });

    map.addSource("spot-buildings", { type: "geojson", data });
    // Status glow halo (§4.2): a soft wide circle under the dot, only for
    // buildings holding a live confident verdict — "active" in the plan's
    // sense. Color mirrors the dot's tone; applyCategory swaps the property.
    map.addLayer({
      id: "spot-buildings-glow",
      type: "circle",
      source: "spot-buildings",
      paint: {
        "circle-radius": 11,
        "circle-blur": 1,
        "circle-color": toneColor("foodTone"),
        "circle-opacity": 0.55,
      },
    });
    map.addLayer({
      id: "spot-buildings-dot",
      type: "circle",
      source: "spot-buildings",
      // Dot color: live tone when one exists (§4.3 semantics), else
      // open-green / closed-gray — honest by construction.
      paint: {
        "circle-radius": 3.5,
        "circle-color": toneColor("foodTone"),
        "circle-opacity": 0.95,
      },
    });
    map.addLayer({
      id: "spot-buildings-label",
      type: "symbol",
      source: "spot-buildings",
      layout: {
        "text-field": ["get", "building"],
        "text-font": ["Noto Sans Bold"],
        "text-size": 11.5,
        "text-anchor": "top",
        "text-offset": [0, 0.7],
        "text-letter-spacing": 0.02,
      },
      paint: {
        "text-color": "#DAD7CE",
        "text-halo-color": "#121110",
        "text-halo-width": 1.3,
      },
    });

    // Category sync (Alan, 2026-07-11; amended 2026-07-24 after his report
    // that name tags vanish on the Study tab).
    //
    // Name tags are now ALWAYS shown, on both tabs. Hiding them made the map
    // lose its wayfinding: a building's name is context ("where am I?"), not
    // a claim about our data, and deleting half the labels on a tab switch
    // reads as breakage. What the tab changes is EMPHASIS, not existence —
    // labels for buildings without spots of the active category dim rather
    // than disappear (both tones ≥5:1 against the label halo, §4.8).
    //
    // Dot and glow stay category-gated, because those ARE data claims: a dot
    // says "we have spots of this kind here" and the glow says "we have a
    // live confident verdict". Showing a dot on a building with no seeded
    // study zones would assert knowledge we don't have (§4.4).
    //
    // Footprint highlight splits by category on purpose: food is
    // vendor-located (only some buildings have it), while study space is
    // effectively everywhere on campus — so Study highlights every building
    // as in-play. That's a real asymmetry, not an inconsistency.
    const applyCategory = (category: Category) => {
      const hasCategory = ["==", ["get", category], true] as maplibregl.FilterSpecification;
      const tone = category === "food" ? ("foodTone" as const) : ("studyTone" as const);
      map.setFilter("spot-buildings-dot", hasCategory);
      map.setFilter("spot-buildings-label", null); // every name tag, always
      map.setPaintProperty("spot-buildings-label", "text-color", [
        "case",
        ["==", ["get", category], true],
        "#DAD7CE", // has spots of this category — full emphasis (13.1:1)
        "#9A9488", // context only — recessive but legible (6.3:1)
      ]);
      // Glow only where the active category has a live tone.
      map.setFilter("spot-buildings-glow", [
        "all",
        hasCategory,
        hasTone(tone),
      ] as unknown as maplibregl.FilterSpecification);
      map.setPaintProperty("spot-buildings-dot", "circle-color", toneColor(tone));
      map.setPaintProperty("spot-buildings-glow", "circle-color", toneColor(tone));
      clearSelection();
      for (const b of buildings) {
        map.setFeatureState(
          { source: "campus-buildings", id: b.building },
          { active: category === "study" ? true : b.food },
        );
      }
    };
    applyCategory("food"); // sheet's default tab

    const onCategory = (e: Event) => {
      applyCategory((e as CustomEvent<CategoryEventDetail>).detail.category);
    };
    window.addEventListener(CATEGORY_EVENT, onCategory);

    // Recenter: ease the camera home (§Phase 3 task). Motion duration sits in
    // the §4.6 window ballpark; easeTo respects prefers-reduced-motion via
    // MapLibre's own reduced-motion handling.
    const onRecenter = () => {
      map.easeTo({
        center: CAMPUS_CENTER,
        zoom: 14.6,
        bearing: 0,
        pitch: CAMPUS_PITCH,
        duration: 600,
      });
    };
    window.addEventListener(RECENTER_EVENT, onRecenter);

    // Cleanup note: deps are stable for a given page load (server-computed
    // buildings), so this effect runs once; the early-return path above never
    // re-registers listeners.
    return () => {
      window.removeEventListener(CATEGORY_EVENT, onCategory);
      window.removeEventListener(RECENTER_EVENT, onRecenter);
    };
  }, [buildings, styleLoaded]);

  // Size with h/w, not inset-0: MapLibre's own CSS forces the container to
  // position:relative, which would cancel inset-0 and collapse it to height 0.
  return <div ref={containerRef} className="h-full w-full" />;
}
