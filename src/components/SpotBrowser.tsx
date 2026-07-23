"use client";

import { useEffect, useState } from "react";
import { FilterChips } from "@/components/FilterChips";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SortMenu } from "@/components/SortMenu";
import { SpotRow } from "@/components/SpotRow";
import { useNowMs } from "@/lib/clock";
import { CHIPS_BY_CATEGORY, matchesChip } from "@/lib/filters";
import { recordFollowUpCandidate } from "@/lib/followup";
import { CATEGORY_EVENT, type CategoryEventDetail } from "@/lib/map-events";
import { SORTS_BY_CATEGORY, sortSpots } from "@/lib/sort";
import type { Category, SpotListItem } from "@/lib/types";

// Client owner of browse state (tab now; filters/sort in tasks 5–6). Local
// component state, not a store or URL — it's ephemeral view state with exactly
// one consumer, and the full spot list is already in props (§12 Phase 2).
// `nowMs` comes from the server render so hydration sees identical output.
export function SpotBrowser({
  items,
  nowMs,
}: {
  items: SpotListItem[];
  nowMs: number;
}) {
  const [category, setCategory] = useState<Category>("food");
  // Chip selection is per-category so switching tabs doesn't carry a stale
  // filter across ("Vegan" means nothing on the Study list).
  const [chipByCategory, setChipByCategory] = useState<
    Record<Category, string | null>
  >({ food: null, study: null });
  // Defaults per §1.3: food "Shortest line", study "Best outlets" (index 0).
  const [sortByCategory, setSortByCategory] = useState<Record<Category, string>>(
    { food: "shortest-line", study: "best-outlets" },
  );
  // §13.2: location is requested at first benefit — picking "Closest" — never
  // on load. Used in-memory only; never stored or sent anywhere.
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  // Server time for hydration, then the live minute-tick clock (§4.4): rows
  // re-verdict as data ages instead of freezing at render time.
  const now = new Date(useNowMs(nowMs));

  const chips = CHIPS_BY_CATEGORY[category];
  const activeChip = chips.find((c) => c.id === chipByCategory[category]) ?? null;
  const sorts = SORTS_BY_CATEGORY[category];
  const activeSort =
    sorts.find((s) => s.id === sortByCategory[category]) ?? sorts[0];

  const handleSortChange = (id: string) => {
    setSortByCategory((prev) => ({ ...prev, [category]: id }));
    if (id === "closest" && !location && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, // denied → "Closest" degrades to unsorted; no nagging
        { maximumAge: 60_000 },
      );
    }
  };

  const visible = sortSpots(
    items.filter(
      (item) =>
        item.category === category && matchesChip(activeChip, item.attributes),
    ),
    activeSort,
    { now, location },
  );

  // Best bet = the top row of the sorted list (§1.3) — the sort order IS the
  // recommendation. Never crown a closed spot: recommending somewhere you
  // can't go is worse than recommending nothing.
  const bestBet = visible[0]?.isOpen ? visible[0] : null;
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
          value={category}
          onChange={(next) => {
            setCategory(next);
            // Map highlights follow the active tab (MapView listens).
            window.dispatchEvent(
              new CustomEvent<CategoryEventDetail>(CATEGORY_EVENT, {
                detail: { category: next },
              }),
            );
          }}
        />
        {/* Subbar (mockup): chips left, sort right. */}
        <div className="mt-3 flex items-center gap-2">
          <FilterChips
            chips={chips}
            activeId={chipByCategory[category]}
            onChange={(id) =>
              setChipByCategory((prev) => ({ ...prev, [category]: id }))
            }
          />
          <SortMenu
            options={sorts}
            activeId={activeSort.id}
            onChange={handleSortChange}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        // §4.7 voice: dry and factual. Grits artwork joins in Phase 7 polish.
        <div className="px-5 py-12 text-center">
          <p className="text-sm font-semibold">
            {activeChip
              ? `Nothing matches “${activeChip.label}”.`
              : category === "study"
                ? "No study spots yet."
                : "No food spots yet."}
          </p>
          <p className="mt-1 text-xs text-muted">
            {activeChip
              ? "Try a different filter."
              : "Zones are being mapped now."}
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
      )}
    </div>
  );
}
