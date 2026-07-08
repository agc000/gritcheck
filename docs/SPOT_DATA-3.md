# GritCheck — Spot Data (Phase 0 input)

**Instructions for Alan:** fill every `___`. Delete rows that don't belong, add rows I missed.
Rows marked `(?)` are my guesses — confirm the spot exists or delete it.
**Instructions for Claude Code:** this file + the URLs below are the Phase 0 source of truth.
Convert to `scraper/seed/spots.json`. Ask Alan about anything ambiguous. Never invent values.

---

## Part 1 — Scraper sources (hours come from here, not from this doc)

| Source | URL | Covers |
|---|---|---|
| UMBC Dining | https://dineoncampus.com/umbc/hours-of-operation | All dining spot hours |
| AOK Library | https://library.umbc.edu/location.php#hours | Library (incl. Einstein Bros) hours |
| UMBC OpenNow | ___ (Alan: find URL) | Live building unlock status — Phase 0: assess if scrapable |

**Rule:** if a spot's hours are on one of these pages, its Hours column below says `scrape:dining` or `scrape:library`. Manual hours are ONLY for spots with no published source — and Alan verifies those in person or via OpenNow, not from AI summaries (the hours in Alan's earlier research doc were contradictory; treat them as unverified).

---

## Part 2 — Food spots (roster + coords from Alan, July 2026)

Tags: coffee, vegetarian, vegan, halal, open_late, meal_swipe, mobile_order
**Consensus lines below are DRAFTS** built from Alan's opinions + distilled student sentiment — Alan approves/rewrites each in his own voice before seeding. `___` still needs Alan.

| Name | Building | Lat, Lng | Hours | Tags | Consensus line (DRAFT — Alan to approve) | Typical pattern |
|---|---|---|---|---|---|---|
| True Grit's | True Grit's (residential side) | 39.255866, -76.707668 | scrape:dining | meal_swipe, halal, vegetarian, open_late | Hit or miss, but rarely a line. Clutch for late night. | ___ |
| Chick-fil-A | University Center | 39.254109, -76.713173 | scrape:dining | ___ | Always solid, always a line. Go after 1pm. | huge line 12–1 → verify |
| Starbucks | University Center | 39.254465, -76.713014 | scrape:dining | coffee, mobile_order | Same Starbucks as anywhere. Mobile order skips the line. | ___ |
| Halal Shack | Commons | 39.255193, -76.711360 | scrape:dining | halal | Best food in the Commons — everyone knows it, hence the line. | ___ |
| Dunkin' | Commons | 39.254574, -76.710936 | scrape:dining | coffee | Weaker than off-campus Dunkin. Double-check your order. | ___ |
| Wild Greens | Commons | 39.255153, -76.711216 | scrape:dining | vegetarian, vegan | Always solid, never a line. | ___ |
| Yellas | Commons | 39.255182, -76.711328 | scrape:dining | ___ | Very solid burger. | ___ |
| Piccolo Italia | Commons | 39.255089, -76.711018 | scrape:dining | ___ | Solid pizza — same as the dining hall's, shorter walk. | ___ |
| Pollo | Commons | ___ (Alan: confirm still open) | scrape:dining | ___ | ___ | ___ |
| Blends and Bowls | Commons | 39.255090, -76.711006 | scrape:dining | vegetarian?, ___ | Below-average smoothies and bowls. | ___ |
| Indian Kitchen | Commons | 39.255139, -76.711377 | scrape:dining | ___ | Mid Indian — fine, not the best. | ___ |
| Copperhead Jack's | Commons | 39.255090, -76.711006 | scrape:dining | ___ | Chipotle-style bowls. Good every now and then. | ___ |
| Sushi Do | Commons | 39.255250, -76.711275 | scrape:dining | ___ | Mid at best. | ___ |
| Yum Shoppe (market) | Commons ground floor | 39.254551, -76.710894 | scrape:dining | ___ | Cheapest snacks and quick meals on campus. | ___ |
| Skylight Room | Commons 3rd floor | 39.255087, -76.711144 | scrape:dining | ___ | Sit-down spot upstairs. Check what your plan covers first. | ___ |
| Admin Coffee Shop | Administration | 39.252959, -76.713397 | manual: ___ | coffee | **CONFLICT — Alan says mid; students call it a hidden gem with the best lunches. Alan decides.** | ___ |
| Einstein Bros | AOK Library | 39.256313, -76.711555 | scrape:library | coffee | Solid bagels and desserts. Slow, and sells out late in the day. | ___ |

**Student-sourced signals** (distilled from Reddit, unverified — useful for Typical pattern column): Chick-fil-A line peaks 12–1, calmer after 1; D-Hall lines shortest near end of dinner (~6:30–7:30); Einstein runs out of bagels late in the day; Halal Shack draws the longest Commons lines; D-Hall open very late (verify current close time). Treat these as hypotheses until Alan confirms — hours and concepts change year to year.

**Note for CC (Phase 0):** dineoncampus.com blocks basic fetches (bot detection). Investigate their underlying JSON API (the site is client-rendered from an api.dineoncampus.* endpoint) before resorting to headless scraping — the API is likely cleaner and more stable than HTML anyway.
**Note for Alan:** SGA already ships "UMBC MenuView" (apps.sga.umbc.edu) — menus only, no live conditions. Validates demand, no overlap with GritCheck's core, and SGA is a partnership path (§7).

## Part 3 — Study spots (floor/zone granularity — this is the moat)

Tags: silent, group_ok, whiteboards, open_24h, near_food · Outlets: good / limited / bad · Seating: tables / couches / mixed

| Name | Building | Lat, Lng | Hours | Outlets | Tags | Seating | Consensus line | Typical pattern |
|---|---|---|---|---|---|---|---|---|
| ILSB — 2nd Floor | ILSB | ___ | manual: M–Th 7:30a–10p, F 7:30a–5p, closed wknd (Alan: verify) | good? | ___ | ___ | ___ | ___ |
| ILSB — 1st Floor (?) | ILSB | ___ | manual: same as above? | ___ | ___ | ___ | ___ | ___ |
| AOK Library — 7th Floor | AOK | ___ | scrape:library | ___ | silent, ___ | ___ | ___ | ___ |
| AOK Library — 2nd Floor (?) | AOK | ___ | scrape:library | ___ | group_ok, whiteboards?, ___ | ___ | ___ | ___ |
| AOK Library — 1st Floor (?) | AOK | ___ | scrape:library | ___ | ___ | ___ | ___ | ___ |
| Engineering Atrium (?) | Engineering | ___ | manual: ___ | ___ | ___ | ___ | ___ | ___ |
| UC — 2nd Floor (?) | University Center | ___ | manual: ___ | ___ | ___ | ___ | ___ | ___ |
| Commons — 2nd Floor (?) | Commons | ___ | manual: follows Commons bldg | ___ | group_ok, near_food, ___ | ___ | ___ | ___ |
| (add 6–12 more zones you actually study in — lounges, department buildings, quiet corners) | | | | | | | | |

## Part 4 — Walk-time anchors (optional, Phase 2)
Pick 2–3 spots students walk from (e.g., "center of Academic Row") with lat/lng: ___

---
### How to get Lat, Lng in 10 seconds
Google Maps → find the building entrance → right-click → click the coordinates to copy → paste here.

### Consensus line rules (from BUILD_PLAN §3.3)
≤90 chars, present tense, specific, zero corny. Good: "Sweetest coffee on campus. Fastest line before 10am." Bad: "A great place to grab a bite!"
