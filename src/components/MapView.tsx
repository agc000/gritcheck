"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// One marker per building (grouped server-side in page.tsx — the Commons
// holds ~10 vendors on one roof, so per-spot pins would stack illegibly).
import {
  CATEGORY_EVENT,
  EXPAND_SHEET_EVENT,
  RECENTER_EVENT,
  type CategoryEventDetail,
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
};

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
  const router = useRouter();

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
    map.once("load", () => {
      map.resize();
      setStyleLoaded(true);
      // Collapse the compact attribution to its ⓘ toggle immediately: it
      // auto-expands on load, and its text block literally became the page's
      // LCP element in the Lighthouse gate. OSM's mobile guidance accepts
      // the collapsed toggle; the text stays one tap away.
      map
        .getContainer()
        .querySelector(".maplibregl-ctrl-attrib")
        ?.classList.remove("maplibregl-compact-show");
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
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
      if (marker.slugs.length === 1) {
        router.push(`/spots/${marker.slugs[0]}`);
      } else {
        window.dispatchEvent(new CustomEvent(EXPAND_SHEET_EVENT));
      }
    });

    // Tap on empty map: drop any gold selection (the sheet collapse for the
    // same tap is handled by Sheet's own listener).
    map.on("click", (e) => {
      const hits = map.queryRenderedFeatures(e.point, {
        layers: ["campus-buildings-fill"],
      });
      if (hits.length === 0) clearSelection();
    });

    map.addSource("spot-buildings", { type: "geojson", data });
    map.addLayer({
      id: "spot-buildings-dot",
      type: "circle",
      source: "spot-buildings",
      // Status tone v1 (§4.3 semantics): go-green when any spot inside is
      // open, closed-gray otherwise. All gray until hours are seeded — honest
      // by construction. Per-verdict glow lands with Phase 4 live statuses.
      paint: {
        "circle-radius": 3.5,
        "circle-color": [
          "case",
          ["==", ["get", "open"], true],
          "#2CB56E",
          "#8B93A4",
        ],
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

    // Category sync (Alan, 2026-07-11): the map highlights only buildings
    // holding spots of the active sheet tab — Food buildings on Food, Study
    // on Study. Inactive buildings drop to the dim context color and lose
    // dot/label. Study currently dims everything (no study coords seeded
    // yet); it lights up the moment Part 3 data lands.
    const applyCategory = (category: Category) => {
      const visible = ["==", ["get", category], true] as maplibregl.FilterSpecification;
      map.setFilter("spot-buildings-dot", visible);
      map.setFilter("spot-buildings-label", visible);
      clearSelection();
      for (const b of buildings) {
        map.setFeatureState(
          { source: "campus-buildings", id: b.building },
          { active: category === "food" ? b.food : b.study },
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
    // buildings, router), so this effect runs once; the early-return path
    // above never re-registers listeners.
    return () => {
      window.removeEventListener(CATEGORY_EVENT, onCategory);
      window.removeEventListener(RECENTER_EVENT, onRecenter);
    };
  }, [buildings, styleLoaded, router]);

  // Size with h/w, not inset-0: MapLibre's own CSS forces the container to
  // position:relative, which would cancel inset-0 and collapse it to height 0.
  return <div ref={containerRef} className="h-full w-full" />;
}
