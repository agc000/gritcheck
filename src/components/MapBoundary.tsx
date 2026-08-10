"use client";

import { Component, type ReactNode } from "react";

// Component-level error boundary for the map ONLY.
//
// Why this exists (Phase 7, from production telemetry 2026-08-09): two real
// users hit a WebGL context failure and lost the ENTIRE app. `new
// maplibregl.Map()` threw, nothing caught it, and the error travelled up to
// Next's route boundary — which replaces the whole page with "This page stopped
// working." So a graphics-driver problem took down the spot list, the hours and
// the update button, none of which need WebGL at all.
//
// The map is the one genuinely optional part of this screen: §4.2 puts the
// answer in the sheet, and the sheet is server-painted. Nothing here should be
// able to cost a student the list.
export class MapBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    // Same first-party sink the route boundaries use — CSP blocks any other
    // outbound origin (§Phase 5), so errors go to the events table or nowhere.
    // Dynamic import: keep the logger off the critical path.
    void import("@/lib/errors")
      .then((m) => m.logClientError(error, "map"))
      .catch(() => {});
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Can this device actually give MapLibre a WebGL context?
 *
 * Checked BEFORE mounting rather than catching the throw, because "this phone
 * cannot render the map" is an ordinary condition on older hardware and in iOS
 * Low Power Mode — not an exception. maplibre-gl v5 removed the old
 * `supported()` helper, so this is the check it used to do.
 */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (!gl) return false;
    // Release it immediately: contexts are a scarce per-tab resource and this
    // one exists only to answer the question.
    (gl as WebGLRenderingContext)
      .getExtension("WEBGL_lose_context")
      ?.loseContext();
    return true;
  } catch {
    return false;
  }
}
