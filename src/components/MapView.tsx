"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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
    map.once("load", () => map.resize());
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Size with h/w, not inset-0: MapLibre's own CSS forces the container to
  // position:relative, which would cancel inset-0 and collapse it to height 0.
  return <div ref={containerRef} className="h-full w-full" />;
}
