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
- [x] **"Retriever Burger Company"** RESOLVED 2026-07-13 — Alan: RBC is the OLD name,
  Yellas is current. The official where-to-eat page is stale; roster unchanged.
- [ ] **Einstein Bros: "open 7 days a week during semester"** per the same official page —
  our provisional Mon–Fri seed is summer-plausible but wrong for fall. Scraper (Phase 6)
  will correct it; if seeding again before then, add weekend rows.
- [ ] **Admin Coffee Shop:** feed calls it "The Coffee Shoppe" (building: Admin) and it **is**
  scrapable — SPOT_DATA's `manual: ___` can become `scrape:dining`. Confirm same place.
  Also: the consensus-line CONFLICT (you: mid; students: hidden gem) still needs your call.
- [ ] **Einstein Bros:** it's in the *dining* feed (`einstein-brother-s-bagels`), so hours come
  from `scrape:dining`, not `scrape:library` as SPOT_DATA currently says. Confirm.
- [ ] **Piccolo vs Piccola Italia:** feed slug mapping stays `piccola-italia`; Alan will confirm
  the sign in person — the display name may flip.

## 1b. Feed reconciliation — week of Aug 2 2026 (added 2026-08-04)

*Source: live `apiv4.dineoncampus.com/locations/weekly_schedule` capture, 25
locations (20 venues + 5 building rows). The join key is **dineoncampus
`location.slug` ↔ `hours_source.source_slug`** — not the display name, and not
our spot slug. Every currently mapped row still resolves; nothing is orphaned.*

**PHYSICAL VERIFICATION NEEDED — the feed cannot settle these.** Three venues
carry a signature no other venue has: **no building parent** (`building_id: ""`)
and **zero payment methods configured**. All three are the "Additional
Locations" group.

| feed slug | feed name | building parent | pay methods | reading |
|---|---|---|---|---|
| `piccola-italia` | "Piccola Italia" | Commons | 4 | established, mapped |
| `picola-italia` | "Picola Italia" | **none** | 0 | orphan — misspelling? |
| `blends-and-bowls` | "Blends and Bowls" | Commons | 0 | mapped |
| `blends-bowls` | "Blends & Bowls" | **none** | 0 | orphan — ampersand variant? |
| `jerk-lime` | "Jerk + Lime" | **none** | 0 | orphan, but genuinely new |

- [ ] **`picola-italia` — one spot or two?** The name is a misspelling of the
  mapped `piccola-italia` and it has no building parent, which points hard at a
  CMS duplicate. But `jerk-lime` shares that exact signature and is a real new
  venue, so **orphan status does not prove duplicate**. Stand in the Commons and
  count the counters. If duplicate: leave the mapping alone. If real: it needs
  its own spot row.
- [ ] **`blends-bowls` — same question.** "Blends & Bowls" vs the mapped
  "Blends and Bowls". Same orphan signature.
- [ ] **`jerk-lime` "Jerk + Lime" — CONFIRMED ABSENT from SPOT_DATA-3.md
  entirely.** Not a naming mismatch; there is no row. Needs coords, tags, and a
  consensus line before it can be seeded.
- [ ] **`true-grit-s-retriever-market`** — in the feed with a True Grit's
  building parent and full payment config (so it is a real, established venue),
  but still unseeded. SPOT_DATA row 42 exists with `___` coords and `___` tags.
  Decide: seed it or drop the row.

**Name mismatches (all cosmetic — the join is on slug, so none of these break
anything):**

| our name | feed name |
|---|---|
| Piccolo Italia | Piccola Italia |
| Yellas | Yella's |
| Copperhead Jack's | Copperhead Jacks |
| Einstein Bros | Einstein Brother's Bagels |
| Skylight Room | The Skylight Room |
| Admin Coffee Shop | The Coffee Shoppe |
| Dunkin' | Dunkin |
| Commons Retriever Market (was Yum Shoppe) | Commons Retriever Market |

- [ ] Decide whether display names should follow the feed or stay as Alan writes
  them. Currently ours win, which is correct — the feed is an hours source, not a
  branding authority.

**Roster reconciliation (SPOT_DATA Part 2 has 17 food rows; seed has 15):**

- `True Grit's Retriever Market` — in the doc, **never seeded** (row is all `___`)
- `Skylight Room` — was seeded, **removed 2026-08-04** on Alan's instruction
  ("remove that from UMBC dining"). Still present and `active` in production
  until `update spots set active = false where slug = 'skylight-room'` is run.

17 − 2 = 15. Reconciles exactly; nothing is unaccounted for.

**Not a gap, but worth recording:** True Grit's summer schedule in this capture
is 7:30–9:00, 11:00–13:00, 17:00–18:30, identical all seven days. That is a
scraper-shape reference only — **do not seed it as semester hours** (§Phase 6
fixtures are summer session for exactly this reason).

## 2. Food spot gaps in SPOT_DATA-3.md

- [ ] **Tags** missing for: Chick-fil-A, Yellas, Piccolo Italia, Pollo(?), Indian Kitchen,
  Copperhead Jack's, Sushi Do, Yum Shoppe, Skylight Room. (Note: the feed has
  `pay_with_meal_swipe` per venue — I can prefill `meal_swipe` from it for your review.)
- [ ] **Blends and Bowls:** confirm `vegetarian?`.
- [ ] **Typical pattern** column: blank for every food spot except Chick-fil-A's draft.
  This is the zero-users fallback (§3.4) — the app is only useful day one if these exist.
- [ ] **Consensus lines:** all marked DRAFT — approve or rewrite each in your voice.

## 3. Study spots (the biggest gap — Part 3 is ~10% filled)

> **2026-07-13, from library.umbc.edu/studyspaces.php [OFFICIAL]** — two strong zone
> candidates beyond the 4 already seeded, pending Alan's on-foot confirm:
> - **AOK 2nd Floor study area**: whiteboards, big tables, large monitors with cables —
>   upgrades SPOT_DATA's old "(?)" guess to documented. Also: 16 reservable group rooms
>   (3h cap) + 12 first-come 4-seat open rooms library-wide.
> - **AOK Atrium**: open 24h (separate from RLC), conversation OK — a second 24h zone.
> - PC counts if useful for sub-lines: floors 3–4 have 22 PCs, 5–6 have 32, floors 1/2/7
>   share 160.

- [ ] Lat/lng for every study row (ILSB floors, AOK floors, Engineering, UC, Commons).
- [ ] Confirm which AOK floors are real zones (7th confirmed; 1st/2nd are `(?)` guesses).
- [ ] RLC: it has its own hours in the LibCal feed — add it as a study spot row?
- [ ] ILSB hours: verify the `M–Th 7:30a–10p` guess; no scrapable source found, so `manual`.
- [ ] Per-zone: outlets rating, tags, seating type, consensus line, typical pattern.
- [ ] Add the 6–12 extra zones you actually study in.

## 3b. Study recon reconciliation — two sources, 2026-08-04

*Inputs: `docs/STUDY_SPOTS_RECON.md` (provenance `alan_personal`, 28 zones,
HIGH trust) and `docs/umbc_study_spots_research_2026-08-04.md` (provenance
`web_unverified`, URL-sourced, explicitly not physically inspected).
**Nothing was seeded** — see the blocker below, which is absolute.*

### THE BLOCKER: neither source contains a single coordinate

`spots.lat` / `spots.lng` are NOT NULL and the seed schema enforces a campus
bounding box (39.24–39.27, −76.73–−76.69). **Zero of the 28 zones can be seeded
until Alan walks the buildings and records entrance lat/lng.** This is not a
preference — the validator rejects the rows. 13 buildings need coordinates:
Public Policy, Physics, RAC, ITE, Performing Arts, Fine Arts, Meyerhoff,
Sherman Hall, Sondheim Hall, Math & Psychology, Biological Sciences, Chemistry,
Administration.

### The recon and the seeded roster do not overlap AT ALL

- [ ] **Seeded study spots: 6, of which 5 are AOK and 1 is Commons Top Floor.**
      **Alan's recon: 28 zones, none of them AOK, and its Commons notes stop at
      the 2nd floor.** The intersection is empty. So this is not a
      "fill in the blanks" pass — it is a proposed **6 → 34 expansion**, and
      that is a product decision, not a data entry task. Decide the launch
      roster before the walk, so the walk collects coordinates only for zones
      that will actually ship.
- [ ] **AOK is missing from Alan's personal file entirely** (his own Part 4
      item 8). It is the most-used study building on campus and the only one
      currently seeded. Its 5 rows still have `___` outlets and seating.

### Fields the two sources produce that our schema has nowhere to put

- [ ] **`fill tendency`** (`reliably_open` … `reliably_full`) is the single most
      useful column in Alan's file — `MP-BASE` "almost always empty, very quiet"
      is exactly the answer the product exists to give. It is **not** the §3.4
      baseline (that is time-of-day) and **not** a §3.2 attribute. Decide where
      it lives before the walk, or the walk collects data with no home.
- [ ] **Provenance.** Alan's file mandates that every row carry one and that
      `web_unverified` never overwrite `alan_personal`. **`spots` has no
      provenance column.** Either add one (schema change, needs an amendment) or
      accept that the distinction lives only in these docs.
- [ ] **Noise vocabulary mismatch.** Recon uses `silent|quiet|mid|loud|varies`;
      §3.2 has only a `silent` boolean. `mid` and `loud` have no representation.
- [ ] **Seating vocabulary mismatch.** Recon uses `desks|cubbies|booths|balcony|
      half-rooms`; §3.2 allows only `tables|couches|mixed`.
- [ ] The web file proposes a much richer schema (`official_noise_policy` vs
      `observed_noise_reports[]`, `source_claims[]`, `conflict_flags[]`,
      `physical_audit_status`). **Not adopted** — it is a large §3.2 change for
      a launch that has zero study updates. Recorded as a §10-style trigger: if
      official policy and student reports keep disagreeing, revisit.

### Where the two sources CONTRADICT each other — resolve on the walk

- [ ] **ILSB study rooms.** Alan: *"require advance reservation and are always
      full."* Web: the current official ILSB page says **first come, first
      served**, and the reservation claims trace to 2020–2023 Reddit. One of
      these is out of date. The web file's version is sourced to a live page;
      Alan's is firsthand but may predate a policy change.
- [ ] **ILSB hours conflict with each other officially.** ILSB's own page says
      Mon–Fri 7:30a–10p; UMBC Police says exterior doors lock 4:55p. The web
      file's advice — surface "check live" rather than pick one — is right, and
      we have no UI state for it.
- [ ] **Engineering access.** Old sources claim 24/7; current Police procedures
      say doors lock by 11p weekdays. Do not ship Engineering as 24/7.
- [ ] **AOK 5F/6F "absolute quiet"** is the official policy, but April 2025
      student reports document talking and TikTok recording. Our `silent: true`
      attribute currently asserts the policy as fact.

### Where they AGREE — worth noting, it is the only corroborated outlet data

- **Public Policy 2nd floor outlets = good.** Alan observed it firsthand; the
  web file independently sources window tables beside outlets. This is the only
  zone where two independent sources agree on outlets, and the only non-UNKNOWN
  outlet value in Alan's entire file.

### Still missing after BOTH files

- [ ] **Outlets: 27 of 28 zones UNKNOWN.** Both files say explicitly that no web
      source can supply this. Requires one dedicated physical pass. This is the
      column repeatedly called the product's moat.
- [ ] **Hours for all 13 new buildings.** The web file offers UMBC Police door
      schedules as a backbone, but they are `web_unverified`, describe *door
      unlock times* rather than *study availability*, and contradict ILSB's own
      page. Do not seed them as hours.
- [ ] **The Morning / Midday / Evening / Night crowd chart for all 28 zones AND
      all 6 seeded study spots.** Neither file contains it. Alan's fill-tendency
      column is a *static* tendency, not a time curve.
- [ ] **Consensus lines for all 6 seeded study spots** (still zero).
- [ ] **Zone-identity questions:** `ENG-1` vs the doc's `Engineering Atrium (?)`;
      `SH-3` vs `UC-3` (Alan says Sherman runs "across 3rd floor of UC" — one
      space or two?); `RAC-ENT` vs `RAC-2` (Alan calls 2F the entrance floor).
      Naming these wrong makes them unfindable in the app.
- [ ] **Commons 3rd floor** has no study data from either source, yet
      `commons-top-floor` is already seeded with no hours at all.

## 4. Walk-time anchors (optional until Phase 2)

- [ ] 2–3 anchor points with lat/lng ("center of Academic Row", etc.).

## 5. Phase 1 blockers (accounts — needed before any Supabase/Vercel work)

- [x] Supabase account created. Project linked; schema + seed live (Phase 1).
- [x] Vercel account exists (GitHub login).
- [x] **Domain purchased** — `gritcheck.live` on Porkbun, auto-renew on.
