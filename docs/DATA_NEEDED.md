# DATA_NEEDED — running "Alan provides" checklist

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
- [ ] **Yum Shoppe:** the feed has `commons-retriever-market` ("Commons Retriever Market") and no
  "Yum Shoppe". Same place, renamed? If yes I'll map the slug and keep your display name.
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
