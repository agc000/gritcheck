# GritCheck — Hours + Baselines (Alan's ground truth, July 2026)

**For Claude Code:** this file supersedes the blank Hours/Typical-pattern columns in SPOT_DATA-3.md.
Seed `spot_hours` and baseline/typical-pattern data from here. Every value is labeled by source:

- **[ALAN]** — Alan's direct knowledge. Trust it, seed it.
- **[ALAN, PARSED]** — Alan's data, reformatted by chat-Claude from a messy sheet. Confirm interpretation with Alan if load-bearing.
- **[OFFICIAL]** — from UMBC/AOK Library published pages (July 2026). Reliable for structure (noise designations, 24h status), NOT for current hours.
- **[UNVERIFIED]** — hypothesis or gap-fill. Mark as placeholder in the DB or leave null. Never present to users as fact.

**Global accuracy flag (Alan's own words):** hours are NOT 100% accurate — summer data, official hours
unavailable until near semester start. All hours here = provisional; Phase 6 scraper replaces them.
Seed them so the UI has real open/closed logic to render, and tag the source as `manual-provisional`.

---

## Part 1 — Food spot hours + typical patterns

**Global pattern rule [ALAN]:** all Commons spots run moderate-to-long lines during the 11 AM–3 PM
window EXCEPT Wild Greens, Piccolo Italia, Yum Shoppe, and the Chinese spot upstairs
(→ CC: "Chinese spot upstairs" is not in the roster — possibly Skylight Room or a missing stall.
**Ask Alan before mapping it to anything.**)

| Spot | Days | Hours | Typical pattern (baseline fallback text) |
|---|---|---|---|
| Chick-fil-A | Mon–Sat [ALAN, PARSED] | Mon–Thu 9 AM–8 PM · Fri 9 AM–4 PM · Sat 9 AM–5 PM [ALAN, PARSED — original row was garbled; confirm this split] | Moderate line most of the day; peaks near close; lightest 2–4 PM [ALAN] |
| Admin Coffee Shop | Mon–Fri [ALAN] | 7:30 AM–2 PM [ALAN] | Light-to-moderate line all day; busiest 11–12 [ALAN] |
| Blends and Bowls | Mon–Fri [ALAN] | 8:30 AM–5 PM [ALAN] | Light-to-moderate line through the day [ALAN — self-noted low confidence] |
| CRM | Mon–Thu [ALAN, PARSED — "M-T" read as Mon–Thu; could be Mon–Tue, confirm] | 7:30 AM–11 PM [ALAN] | Light line, ~4 people max [ALAN]. **CC: "CRM" is not in the SPOT_DATA roster — almost certainly the Retriever Market (the True Grit's Retriever Market question from DATA_NEEDED §1?). Confirm identity + coords with Alan; this may resolve that roster item.** |
| Copperhead Jack's | Mon–Fri [ALAN] | 11 AM–8 PM [ALAN] | Moderate line typically; Commons busiest 11 AM–3 PM [ALAN] |
| Dunkin' | Mon–Fri [ALAN] | 7:30 AM–4 PM [ALAN, PARSED — close written as "4", read as 4 PM] | Very long line mornings; dies down 2–3; moderate near close [ALAN] |
| Einstein Bros | Mon–Fri [ALAN] | 7:30 AM–9 PM [ALAN] | Light-to-moderate; fills up afternoon until 3–4; picks up again at night [ALAN] |
| Halal Shack | Mon–Fri [ALAN] | 11 AM–10 PM [ALAN] | Long lines after classes, roughly 11 AM–4 PM; picks up again toward night; moderate is the floor — rarely light except mid-class blocks [ALAN] |
| Yellas | Mon–Fri [ALAN] | 11 AM–6 PM [ALAN] | Always busy; moderate-to-long line all day [ALAN] |
| Piccolo Italia | Mon–Fri [ALAN] | 11 AM–5 PM [ALAN] | One of the lighter Commons lines (per global rule) [ALAN, PARSED] |
| Wild Greens | Mon–Fri [ALAN] | 11 AM–6 PM [ALAN, PARSED — row collided with Piccolo in source sheet; confirm] | One of the lighter Commons lines (per global rule; "super greens" in Alan's sheet read as Wild Greens — confirm) [ALAN, PARSED] |
| Sushi Do | Mon–Fri [ALAN] | 11 AM–10 PM [ALAN] | No pattern given — moderate-to-long per Commons global rule [UNVERIFIED — derived, not stated] |
| Indian Kitchen | Mon–Fri [ALAN] | 11 AM–6 PM [ALAN] | No pattern given — moderate-to-long per Commons global rule [UNVERIFIED — derived, not stated] |
| Starbucks | Mon–Fri [ALAN] | 8 AM–6 PM [ALAN] | No pattern given [GAP — Alan to supply; SPOT_DATA consensus notes mobile order skips the line] |
| True Grit's | Mon–Sun [ALAN] | Service periods: 7:30–9:30 AM · 11 AM–2 PM · 4:30–8 PM · 9 PM–12 AM [ALAN] | Breakfast always light; lunch moderate; dinner typically full; late night VERY full, especially 9–11 PM [ALAN]. **CC: model as multiple service periods per day, not one open/close span — UI must show "between periods" as closed-until-next-period, not closed-for-the-day.** |
| Yum Shoppe | — | [GAP — no row in Alan's sheet] | One of the lighter Commons lines (per global rule) [ALAN, PARSED] |
| Pollo | — | [GAP — roster question still open: is it open at all?] | [GAP] |
| Skylight Room | — | [GAP — no row in Alan's sheet; possibly the "Chinese spot upstairs"?] | [GAP] |

---

## Part 2 — Study spots (baseline v0)

Context: Alan was off campus last semester and is rebuilding this knowledge firsthand. This section
merges his partial data with UMBC's published space designations. It is a **starting baseline**, not the
moat-quality dataset — floor-level coords, outlets, and seating still need Alan's on-foot pass (DATA_NEEDED §3).

### AOK Library — floor structure [OFFICIAL, July 2026]

| Zone | Noise designation | Notes | Source |
|---|---|---|---|
| 1st Floor — Retriever Learning Commons (RLC) | Collaborative / group | **24-hour access**; UMBC's flagship lively group-study space; reservable group rooms | [OFFICIAL] |
| 1st Floor — general + Atrium | Collaborative | Atrium after library close = UMBC ID only; phone calls allowed | [OFFICIAL] |
| 2nd Floor | (not designated quiet) | 16 reservable group rooms exist library-wide (whiteboards, computers; plus 12 first-come 4-seat rooms) — exact floor placement unconfirmed | [OFFICIAL — floor placement UNVERIFIED] |
| 3rd + 4th Floors | **Quiet** | Whisper-level; ~22 public PCs across these floors | [OFFICIAL] |
| 5th + 6th Floors | **Absolute Quiet** | No talking above whisper, no calls; enforced by staff walkthroughs | [OFFICIAL] |
| 7th Floor | Event/meeting spaces | NOT a general study floor — **corrects SPOT_DATA-3's "AOK 7th Floor silent" guess; replace that row with 5th/6th** | [OFFICIAL] |

**Alan's pattern [ALAN]:** spots available on any floor at almost all times; quiet floors typically the
fullest; ground floor almost always has seats; emptier the higher you go; study areas reservable in advance.
→ **CC: note the tension** — "emptier higher up" vs "quiet floors (3–6) fullest." Read as: seats exist
everywhere, but quiet floors run highest demand relative to capacity. Confirm reading with Alan.

**Suggested seed rows (replace SPOT_DATA-3 Part 3 AOK rows):**
1. AOK — Retriever Learning Commons (1st Fl) — tags: group_ok, whiteboards, open_24h — hours: 24h [OFFICIAL]
2. AOK — 3rd/4th Floor (Quiet) — tags: quiet — hours: scrape:library
3. AOK — 5th/6th Floor (Absolute Quiet) — tags: silent — hours: scrape:library
(Coords: use AOK building coords 39.256313, -76.711555 [ALAN's existing coord] for all; floor label differentiates.)

### The Commons [ALAN — partial]

| Zone | Pattern | Gaps |
|---|---|---|
| Commons — Top Floor | Always full-to-moderate; lighter during popular class times and toward night [ALAN] | outlets/seating/tags [GAP] |
| Commons — Main/Middle Floor | [GAP — Alan started the row, no data yet] | all [GAP] |
| Commons — Bottom Floor | [GAP — Alan started the row, no data yet] | all [GAP] |
| Outside Commons (plaza seating) | [GAP] | all [GAP]; weather-dependent — consider excluding from v1 |

Hours: all Commons zones follow the Commons building schedule [per SPOT_DATA-3 assumption].
Coords: use Commons building coords; floor label differentiates.

### ILSB [OFFICIAL — Alan to verify on foot]

| Zone | What's documented | Source |
|---|---|---|
| ILSB — Atrium study commons | Double-height, sky-lit commons running the building's length; study/relax seating; ~700 classroom+study seats building-wide | [OFFICIAL] |
| ILSB — Study rooms | First-come-first-served; wireless-cast monitors (Mersive Solstice) | [OFFICIAL] |

Hours: SPOT_DATA-3 draft said M–Th 7:30a–10p, F 7:30a–5p, closed weekends [UNVERIFIED — Alan to verify].
Coords: [GAP — ILSB building coords needed; Google Maps right-click].

### Still zero data [GAP — Alan's on-foot list]
Engineering (atrium?), UC upper floors, PAHB, Sherman/Sondheim lounges, department lounges —
target 15–20 total zones per BUILD_PLAN. Usable seed count from this file: ~8–9 zones.

---

## Part 3 — Instructions for CC

1. Seed `spot_hours` for Part 1 spots, source-tagged `manual-provisional` (Phase 6 scraper overwrites).
2. True Grit's needs multi-period day support — verify the schema handles N open/close spans per day
   BEFORE seeding; if it doesn't, that's a migration — flag it to Alan before writing it.
3. Seed baseline/typical-pattern text from the Pattern column — [ALAN] rows near-verbatim (voice pass
   comes later in Alan's consensus review), [UNVERIFIED] rows as marked placeholders or null.
4. Replace SPOT_DATA-3 Part 3's guessed AOK rows with the corrected floor structure above; add RLC.
5. Blocking questions for Alan (ask before seeding the affected rows): CRM identity · "Chinese spot
   upstairs" mapping · Chick-fil-A day-split confirmation · CRM "M-T" = Mon–Thu or Mon–Tue.
6. Do NOT invent anything for [GAP] cells.

## Part 4 — Alan's remaining homework (shrunk, priority order)
1. Answer CC's blocking questions (Part 3 item 5) — 2 minutes.
2. Starbucks pattern + Yum Shoppe/Skylight hours — 5 minutes.
3. ILSB + Engineering coords and an on-foot pass (outlets/seating/noise per zone) — the moat work.
4. Commons middle/bottom floor patterns — the rows are started, finish the two sentences.
5. Pollo roster call.
