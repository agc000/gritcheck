import type { Category } from "./types";

// Cross-tree signals between the map (dynamic client island) and the sheet.
// They live here — NOT in MapView — because a value import from MapView would
// statically pull maplibre-gl into the main bundle and defeat the ssr:false
// code split that keeps the map off the critical path.

// Building tap on a multi-spot building raises the sheet (Sheet listens).
export const EXPAND_SHEET_EVENT = "gritcheck:expand-sheet";

// Food | Study tab change (SpotBrowser dispatches, MapView listens): the map
// highlights only buildings holding spots of the active category.
export const CATEGORY_EVENT = "gritcheck:category";

export type CategoryEventDetail = { category: Category };

// Building tap (MapView) → the sheet list scopes to that building's spots;
// null clears (empty-map tap). detail.building is the buildingKey — the same
// normalized name the geojson features and marker grouping use.
export const SELECT_BUILDING_EVENT = "gritcheck:select-building";

export type SelectBuildingEventDetail = { building: string | null };

// Recenter control (Sheet chrome) → MapView eases the camera home.
export const RECENTER_EVENT = "gritcheck:recenter";

// Update FAB (Sheet chrome) → UpdateSheet opens. Same cross-tree-event
// reasoning: the FAB renders twice (SSR twin + live drawer) and the flow
// lives at page level, so an event beats threading props through Sheet.
// detail.slug pre-selects a spot (the detail page's inline prompt); without
// it the flow geolocates.
export const OPEN_UPDATE_EVENT = "gritcheck:open-update";

export type OpenUpdateEventDetail = { slug?: string };
