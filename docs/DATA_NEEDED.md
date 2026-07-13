# DATA_NEEDED — running "Alan provides" checklist

> **Consolidated priority list (2026-07-11, Phase 3 close).** Everything below
> in one place, ordered by product leverage. Formats: edit SPOT_DATA-3.md or
> just answer in chat — CC converts to seed JSON and loads the DB.
>
> **P0 — makes the app look alive (do these first):**
> 1. **Current hours for 4–6 key spots** (Chick-fil-A, Starbucks, Halal Shack,
>    True Grit's, Einstein, AOK) — per day of week, opens/closes. Manual seed
>    now; the Phase 6 scraper takes over later. Zero hours rows = every row
>    gray "Closed" — this single item flips the whole app to alive.
> 2. **Baseline typical patterns (§3.4) for the same spots** — per day-part,
>    the words students would say: e.g. CFA: mon–fri morning=quiet,
>    midday=packed, afternoon=normal, evening=quiet; weekends=empty.
>    This is the zero-users "metric" the meter idea runs on until Phase 4
>    live reports exist.
>
> **P1 — unblocks the Study tab + map:**
> 3. **Study zones (Part 3)**: lat/lng per zone (Google Maps right-click →
>    copy). ILSB and Engineering have NO coords anywhere. Plus per zone:
>    outlets good/limited/bad, tags, seating, hours (or "follows building"),
>    consensus line, typical pattern. Add the 6–12 zones you actually use.
> 4. **Roster decisions (§1 below)**: Pollo dead? · Yum Shoppe = Commons
>    Retriever Market? · add True Grit's Retriever Market (+coords)? · Admin
>    Coffee Shop consensus conflict — your call · Einstein hours source ·
>    Piccolo vs Piccola sign check.
>
> **P2 — quality pass:**
> 5. Missing tags for ~9 food spots (§2 below; meal_swipe prefillable for review).
> 6. Consensus lines: approve/rewrite every DRAFT in your voice (≤90 chars).
> 7. **Canonical building name per spot** (new, from map-label work): one
>    building key each — e.g. "Commons", not "Commons ground floor" — CC
>    currently normalizes heuristically.
> 8. Walk-time anchors (2–3 points, lat/lng) — powers walk-time sub-lines.
> 9. **Walked lat/lng confirmation** for food spots (Phase 3 exit criterion —
>    open the prod build on your phone at each spot; 30 minutes total).
>

> **Phase 0 CLOSED July 7, 2026 — with one documented exception:** study-spot rows (§3
> below) are still pending from Alan. When they land, add them to `scraper/seed/spots.json`
> and re-run `node scraper/seed/validate.ts`. That re-seed is the only remaining Phase 0
> step and does not block Phase 1's infrastructure work.

Phase 0 recon is done (July 7, 2026). Sources are figured out; what's below is everything
still needed from Alan, in priority order. Check items off by editing
[SPOT_DATA-3.md](SPOT_DATA-3.md) — that file stays the source of truth for spot facts.

---

## Source recon results (for context — no action needed)

| Source | Format | Fixture | Verdict |
|---|---|---|---|
| UMBC Dining | JSON API `apiv4.dineoncampus.com/locations/weekly_schedule?site_id=5751fd3690975b60e04893e2` — but the whole host sits behind Cloudflare bot protection; plain HTTP gets 403. Plain **headless Chromium passes** with no stealth tricks; the scraper loads the hours page and intercepts the JSON. | `scraper/fixtures/dineoncampus-weekly-schedule.json` | ✅ Scrapable (Playwright in GitHub Actions) |
| AOK Library | Clean public JSON: `api3.libcal.com/api_hours_grid.php?iid=991&format=json` — no auth, no bot wall. Covers AOK building hours **and the RLC** (Retriever Learning Center) as separate locations. | `scraper/fixtures/libcal-hours-grid.json` | ✅ Scrapable (plain fetch) |
| UMBC OpenNow | `github.com/umbc-sga/open-now` — hours are **hardcoded in app.js, last commit July 2019**. Seven years stale. | — | ❌ Dead. Removed from the plan. |

Parse spike: `node scraper/spikes/parse-hours.ts` — extracts normalized
`(location, day_of_week, opens, closes)` rows from both fixtures, asserts shape. Passing.

**Caveat:** fixtures were captured during **summer session** — 15 of 22 dining venues show
closed-all-week. Re-capture fixtures in late August for realistic fall data before launch.

---

## 1. Roster decisions (blocks the seed file — quick answers)

- [ ] **Pollo:** absent from the dining feed entirely. Confirm it's gone and delete the row?
- [x] **Yum Shoppe / "CRM":** RESOLVED 2026-07-13 — Alan confirmed CRM = Commons Retriever
  Market; hours (Mon–Thu 7:30a–11p) + light-line baseline seeded on that row.
- [x] **"Chinese spot upstairs":** RESOLVED 2026-07-13 — it's Sushi Do; its baseline upgraded
  from UNVERIFIED-derived to [ALAN] lighter-line.
- [ ] **True Grit's Retriever Market** exists in the feed but not in your roster. Add it as a spot?
- [ ] **Admin Coffee Shop:** feed calls it "The Coffee Shoppe" (building: Admin) and it **is**
  scrapable — SPOT_DATA's `manual: ___` can become `scrape:dining`. Confirm same place.
  Also: the consensus-line CONFLICT (you: mid; students: hidden gem) still needs your call.
- [ ] **Einstein Bros:** it's in the *dining* feed (`einstein-brother-s-bagels`), so hours come
  from `scrape:dining`, not `scrape:library` as SPOT_DATA currently says. Confirm.
- [ ] **Piccolo vs Piccola Italia:** feed slug mapping stays `piccola-italia`; Alan will confirm
  the sign in person — the display name may flip.

## 2. Food spot gaps in SPOT_DATA-3.md

- [ ] **Tags** missing for: Chick-fil-A, Yellas, Piccolo Italia, Pollo(?), Indian Kitchen,
  Copperhead Jack's, Sushi Do, Yum Shoppe, Skylight Room. (Note: the feed has
  `pay_with_meal_swipe` per venue — I can prefill `meal_swipe` from it for your review.)
- [ ] **Blends and Bowls:** confirm `vegetarian?`.
- [ ] **Typical pattern** column: blank for every food spot except Chick-fil-A's draft.
  This is the zero-users fallback (§3.4) — the app is only useful day one if these exist.
- [ ] **Consensus lines:** all marked DRAFT — approve or rewrite each in your voice.

## 3. Study spots (the biggest gap — Part 3 is ~10% filled)

- [ ] Lat/lng for every study row (ILSB floors, AOK floors, Engineering, UC, Commons).
- [ ] Confirm which AOK floors are real zones (7th confirmed; 1st/2nd are `(?)` guesses).
- [ ] RLC: it has its own hours in the LibCal feed — add it as a study spot row?
- [ ] ILSB hours: verify the `M–Th 7:30a–10p` guess; no scrapable source found, so `manual`.
- [ ] Per-zone: outlets rating, tags, seating type, consensus line, typical pattern.
- [ ] Add the 6–12 extra zones you actually study in.

## 4. Walk-time anchors (optional until Phase 2)

- [ ] 2–3 anchor points with lat/lng ("center of Academic Row", etc.).

## 5. Phase 1 blockers (accounts — needed before any Supabase/Vercel work)

- [x] Supabase account created. Project linked; schema + seed live (Phase 1).
- [x] Vercel account exists (GitHub login).
- [x] **Domain purchased** — `gritcheck.live` on Porkbun, auto-renew on.
