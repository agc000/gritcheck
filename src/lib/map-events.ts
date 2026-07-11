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

// Recenter control (Sheet chrome) → MapView eases the camera home.
export const RECENTER_EVENT = "gritcheck:recenter";
