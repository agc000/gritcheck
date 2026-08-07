"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FilterChips } from "@/components/FilterChips";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SortMenu } from "@/components/SortMenu";
import { SpotRow } from "@/components/SpotRow";
import { buildingKey, type CampusBuilding } from "@/lib/buildings";
import { useNowMs } from "@/lib/clock";
import { CHIPS_BY_CATEGORY, matchesChip } from "@/lib/filters";
import { recordFollowUpCandidate } from "@/lib/followup";
import {
  CATEGORY_EVENT,
  COLLAPSE_SHEET_EVENT,
  FIND_BUILDING_EVENT,
  SELECT_BUILDING_EVENT,
  setPendingFind,
  type CategoryEventDetail,
  type FindBuildingEventDetail,
  type SelectBuildingEventDetail,
} from "@/lib/map-events";
import { SORTS_BY_CATEGORY, sortSpots } from "@/lib/sort";
import { baselineWord, liveVerdict } from "@/lib/status";
import type { Category, SpotListItem } from "@/lib/types";

// The sheet's tabs: the two spot categories plus Find Building (2026-07-25,
// Alan — replaced the search-drawer flow), which lists every campus building
// and highlights the tapped one on the map.
type BrowseTab = Category | "buildings";
const TABS: ReadonlyArray<{ value: BrowseTab; label: string }> = [
  { value: "food", label: "Food" },
  { value: "study", label: "Study" },
  { value: "buildings", label: "Find Building" },
];

// Client owner of browse state (tab now; filters/sort in tasks 5–6). Local
// component state, not a store or URL — it's ephemeral view state with exactly
// one consumer, and the full spot list is already in props (§12 Phase 2).
// `nowMs` comes from the server render so hydration sees identical output.
export function SpotBrowser({
  items,
  nowMs,
  campusBuildings,
}: {
  items: SpotListItem[];
  nowMs: number;
  campusBuildings: CampusBuilding[];
}) {
  // Browse state seeds from the URL so it survives a round trip to a spot page
  // and back (§Phase 5 carry-in: tab/filter/sort were component-only, so
  // tapping a row and pressing back dropped a student who had filtered the
  // Study tab onto an unfiltered Food list). Read once, as the initial state —
  // this is NOT a two-way binding, and the URL is written from handlers below.
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<BrowseTab>(() => {
    const t = searchParams.get("tab");
    return t === "study" || t === "buildings" ? t : "food";
  });
  // The spot-list machinery below (chips, sorts, rows) is category-driven;
  // null = the Find Building tab, which uses none of it.
  const category: Category | null = tab === "buildings" ? null : tab;
  // Chip selection is per-category so switching tabs doesn't carry a stale
  // filter across ("Vegan" means nothing on the Study list). Only the restored
  // tab's filter comes from the URL — the other category has never been shown.
  const [chipByCategory, setChipByCategory] = useState<
    Record<Category, string | null>
  >(() => {
    const base: Record<Category, string | null> = { food: null, study: null };
    const f = searchParams.get("filter");
    if (f && category && CHIPS_BY_CATEGORY[category].some((c) => c.id === f)) {
      base[category] = f;
    }
    return base;
  });
  // Defaults per §1.3: food "Shortest line", study "Best outlets" (index 0).
  const [sortByCategory, setSortByCategory] = useState<Record<Category, string>>(
    () => {
      const base: Record<Category, string> = {
        food: "shortest-line",
        study: "best-outlets",
      };
      const s = searchParams.get("sort");
      if (s && category && SORTS_BY_CATEGORY[category].some((o) => o.id === s)) {
        base[category] = s;
      }
      return base;
    },
  );

  // Written with history.replaceState, deliberately NOT router.replace: this
  // page is force-dynamic, so a router navigation per chip tap would be a full
  // server render plus three Supabase queries for a state change the client
  // already made (§Phase 5 perf posture — keep new client work off the wire).
  // replaceState also keeps ONE history entry for the browse screen, so the
  // back button leaves the app instead of unwinding every filter tap.
  const writeUrl = (next: {
    tab: BrowseTab;
    filter: string | null;
    sort: string;
  }) => {
    const params = new URLSearchParams(window.location.search);
    // Defaults stay out of the URL — a shared link should be the short one.
    if (next.tab === "food") params.delete("tab");
    else params.set("tab", next.tab);
    if (next.filter) params.set("filter", next.filter);
    else params.delete("filter");
    const isDefaultSort =
      next.tab !== "buildings" && SORTS_BY_CATEGORY[next.tab][0]?.id === next.sort;
    if (isDefaultSort) params.delete("sort");
    else params.set("sort", next.sort);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };
  // §13.2: location is requested at first benefit — picking "Closest" — never
  // on load. Used in-memory only; never stored or sent anywhere.
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  // Map building tap scopes the list to that building ("what's in here?").
  // Mirrors the map's gold selection; cleared by empty-map tap (MapView
  // dispatches null), the bar's Show-all button, or a tab switch.
  const [building, setBuilding] = useState<string | null>(null);
  useEffect(() => {
    const onSelect = (e: Event) => {
      setBuilding((e as CustomEvent<SelectBuildingEventDetail>).detail.building);
    };
    window.addEventListener(SELECT_BUILDING_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_BUILDING_EVENT, onSelect);
  }, []);
  // Server time for hydration, then the live minute-tick clock (§4.4): rows
  // re-verdict as data ages instead of freezing at render time.
  const now = new Date(useNowMs(nowMs));

  const chips = category ? CHIPS_BY_CATEGORY[category] : [];
  const activeChip = category
    ? (chips.find((c) => c.id === chipByCategory[category]) ?? null)
    : null;
  const sorts = category ? SORTS_BY_CATEGORY[category] : [];
  const activeSort = category
    ? (sorts.find((s) => s.id === sortByCategory[category]) ?? sorts[0])
    : null;

  const handleSortChange = (id: string) => {
    if (!category) return;
    setSortByCategory((prev) => ({ ...prev, [category]: id }));
    writeUrl({ tab, filter: chipByCategory[category], sort: id });
    if (id === "closest" && !location && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, // denied → "Closest" degrades to unsorted; no nagging
        { maximumAge: 60_000 },
      );
    }
  };

  const visible = activeSort
    ? sortSpots(
        items.filter(
          (item) =>
            item.category === category &&
            matchesChip(activeChip, item.attributes) &&
            (building === null || buildingKey(item.building) === building),
        ),
        activeSort,
        { now, location },
      )
    : [];

  // Find Building tap → the map machinery the search drawer used to drive:
  // park the target (map may not be mounted yet), broadcast it, and drop the
  // sheet to the peek sliver so the camera landing is visible.
  const pickBuilding = (b: CampusBuilding) => {
    const detail: FindBuildingEventDetail = {
      name: b.name,
      lng: b.lng,
      lat: b.lat,
      buildingKey: b.buildingKey,
    };
    setPendingFind(detail);
    window.dispatchEvent(
      new CustomEvent<FindBuildingEventDetail>(FIND_BUILDING_EVENT, { detail }),
    );
    window.dispatchEvent(new CustomEvent(COLLAPSE_SHEET_EVENT));
  };

  // Best bet = the top row of the sorted list (§1.3) — the sort order IS the
  // recommendation. Two things disqualify a spot from wearing the crown, and
  // both are the same principle: a recommendation must have something behind it.
  //
  //   1. Closed. Recommending somewhere you cannot go is worse than nothing.
  //   2. Nothing known — no live verdict AND no baseline for this hour. The row
  //      would read "Best bet / No recent data", which is a confident-looking
  //      frame around an admission of ignorance (Alan, 2026-08-04). §4.4's
  //      honesty rule arriving through the sort order rather than the badge.
  //
  // When nothing qualifies there is simply no Best bet — the list still sorts,
  // it just stops pretending the top row is an answer.
  const qualifies = (item: SpotListItem) =>
    item.isOpen &&
    (liveVerdict(item, now) !== null || baselineWord(item.baseline, now) !== null);
  const bestBet = visible[0] && qualifies(visible[0]) ? visible[0] : null;
  const rest = bestBet ? visible.slice(1) : visible;

  // Seeing the Best bet counts as "viewed" for the §4.2 follow-up prompt —
  // it's the recommendation the user acted on (or didn't).
  const bestId = bestBet?.id;
  const bestSlug = bestBet?.slug;
  const bestName = bestBet?.name;
  useEffect(() => {
    if (bestId && bestSlug && bestName) {
      recordFollowUpCandidate({ id: bestId, slug: bestSlug, name: bestName });
    }
  }, [bestId, bestSlug, bestName]);

  return (
    <div>
      <div className="sticky top-0 z-10 bg-sheet px-4 pt-1 pb-3">
        <SegmentedControl
          options={TABS}
          value={tab}
          onChange={(next) => {
            setTab(next);
            writeUrl({
              tab: next,
              filter: next === "buildings" ? null : chipByCategory[next],
              sort: next === "buildings" ? "" : sortByCategory[next],
            });
            // Tab switch drops the building scope — the map drops its gold
            // selection on the same signal (applyCategory), so the two stay
            // mirrored even when the map isn't mounted yet.
            setBuilding(null);
            // Map highlights follow the active spot tab (MapView listens).
            // Find Building leaves the map's category state as-is: the tab is
            // wayfinding over whatever was already lit.
            if (next !== "buildings") {
              window.dispatchEvent(
                new CustomEvent<CategoryEventDetail>(CATEGORY_EVENT, {
                  detail: { category: next },
                }),
              );
            }
          }}
        />
        {/* Subbar (mockup): chips left, sort right. Find Building has
            neither — the whole tab is one alphabetical list. */}
        {category && activeSort && (
          <div className="mt-3 flex items-center gap-2">
            <FilterChips
              chips={chips}
              activeId={chipByCategory[category]}
              onChange={(id) => {
                setChipByCategory((prev) => ({ ...prev, [category]: id }));
                writeUrl({ tab, filter: id, sort: sortByCategory[category] });
              }}
            />
            <SortMenu
              options={sorts}
              activeId={activeSort.id}
              onChange={handleSortChange}
            />
          </div>
        )}
      </div>

      {tab === "buildings" && (
        <ul className="divide-y divide-line">
          {campusBuildings.map((b) => (
            <li key={b.name}>
              <button
                type="button"
                onClick={() => pickBuilding(b)}
                className="flex w-full items-baseline justify-between gap-3 px-4.5 py-3 text-left"
              >
                <span className="min-w-0 truncate text-[14px] font-semibold">
                  {b.name}
                </span>
                {b.spots !== undefined && (
                  <span className="shrink-0 text-[12px] text-muted">
                    {b.spots} {b.spots === 1 ? "spot" : "spots"}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {category && building && (
        // The sheet's mirror of the map's gold building selection — gold-soft
        // like the Best bet card (the sanctioned selection wash, §4.1).
        <div className="mx-2.5 mb-1.5 flex items-center justify-between gap-3 rounded-card bg-gold-soft px-3.5 py-2">
          <p className="min-w-0 truncate text-[13px] font-semibold">
            In {building}
          </p>
          <button
            type="button"
            onClick={() => setBuilding(null)}
            // Padded to the §4.8 44px tap floor; negative margin keeps the
            // bar compact (nav-link idiom).
            className="-my-2 shrink-0 py-3 text-[12.5px] font-semibold text-muted"
          >
            Show all
          </button>
        </div>
      )}

      {category &&
        (visible.length === 0 ? (
          // §4.7 voice: dry and factual.
          // PLACEHOLDER — Alan to replace: §4.7 gives empty states to Grits
          // (visually only). No artwork in the repo yet; the copy below is
          // final and the illustration drops in above it.
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold">
              {/* Phase 7 copy pass. Was "Nothing in AOK Library to study in
                  yet." — grammatical but knotted. Leading with the plain noun
                  reads at a glance and survives a long building name. */}
              {building
                ? activeChip
                  ? `No “${activeChip.label}” spots in ${building}.`
                  : `No ${category === "study" ? "study" : "food"} spots in ${building} yet.`
                : activeChip
                  ? `Nothing matches “${activeChip.label}”.`
                  : category === "study"
                    ? "No study spots yet."
                    : "No food spots yet."}
            </p>
            <p className="mt-1 text-xs text-muted">
              {/* Was "Show all looks across campus." — a sentence whose subject
                  is a button, which reads as a typo until you spot the control.
                  Name the action instead. */}
              {building
                ? "Tap Show all to see the rest of campus."
                : activeChip
                  ? "Try a different filter."
                  : "More spots are coming."}
            </p>
          </div>
        ) : (
          <>
            {bestBet && <SpotRow item={bestBet} now={now} best />}
            <ul className="divide-y divide-line">
              {rest.map((item) => (
                <li key={item.slug}>
                  <SpotRow item={item} now={now} />
                </li>
              ))}
            </ul>
          </>
        ))}
    </div>
  );
}
