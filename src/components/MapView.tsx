"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// One marker per building (grouped server-side in page.tsx — the Commons
// holds ~10 vendors on one roof, so per-spot pins would stack illegibly).
export type BuildingMarker = {
  building: string;
  lat: number;
  lng: number;
  spots: number;
  slugs: string[];
};

// Cross-component signal: building tap on a multi-spot building raises the
// sheet (Sheet.tsx listens). A module event keeps map and sheet decoupled —
// they live in separate trees under the server-component home page.
export const EXPAND_SHEET_EVENT = "gritcheck:expand-sheet";

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
        properties: { building: b.building, spots: b.spots },
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
          "#3B372C",
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
      paint: {
        "circle-radius": 3,
        "circle-color": "#DAD7CE",
        "circle-opacity": 0.9,
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
  }, [buildings, styleLoaded, router]);

  // Size with h/w, not inset-0: MapLibre's own CSS forces the container to
  // position:relative, which would cancel inset-0 and collapse it to height 0.
  return <div ref={containerRef} className="h-full w-full" />;
}
