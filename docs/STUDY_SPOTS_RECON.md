# GritCheck — Study Spots Recon (Source A: Alan, personal)

**Provenance:** `alan_personal` — Alan's own observations from studying on campus, Aug 2026.
**Trust level:** HIGH. Walked and observed firsthand. This is the highest-trust source in the project.
**Scope:** static attributes only (noise, seating, outlets, crowding tendency). Contains NO hours and NO coordinates.

---

## Instructions for Claude Code

1. **Do not merge this file with any ChatGPT/web-scraped source.** A second file (`STUDY_SPOTS_RECON_WEB.md`, provenance `web_unverified`) is coming. Every row that reaches `spots` must carry a provenance field. Never let `web_unverified` data overwrite `alan_personal` data.
2. **`UNKNOWN` means unknown.** Never fill it. Never infer a value from an adjacent field. Every `UNKNOWN` in the outlets column is a real gap that requires a physical walk.
3. **Do not seed from this file yet.** No coordinates exist for any building below. Report a proposed diff to `docs/DATA_NEEDED.md` first.
4. **Alan's verbatim text is preserved in Part 3.** If any extracted value in Part 2 looks wrong, check it against the verbatim and flag the discrepancy rather than silently correcting it.

### Controlled vocabularies used below
- **Noise:** `silent` | `quiet` | `mid` | `loud` | `varies`
- **Outlets:** `good` | `limited` | `bad` | `UNKNOWN`
- **Seating:** `tables` | `desks` | `cubbies` | `booths` | `couches` | `balcony` | `mixed`
- **Fill tendency:** `reliably_open` | `usually_open` | `varies` | `usually_taken` | `reliably_full`
  (This is a *tendency*, not a live state. It is NOT the same field as the Morning/Midday/Evening/Night
  crowd chart, which is tracked separately and is still unfilled for every zone below.)

---

## Part 1 — What this file adds

**13 buildings not present anywhere in `docs/SPOT_DATA-3.md`:**
Public Policy, Physics, RAC, ITE, Performing Arts, Fine Arts, Meyerhoff, Sherman Hall,
Sondheim Hall, Math & Psychology, Biological Sciences, Chemistry, Administration (as a *study* venue —
it exists in the doc only as a dining location).

**4 existing doc rows now have real data** where they previously held `___` guesses:
`ILSB — 1st Floor`, `ILSB — 2nd Floor`, `Commons — 2nd Floor`, `UC — 2nd Floor`.

**1 existing doc row is contradicted:** see `ENG-1` in Part 4.

---

## Part 2 — Extracted zones (28)

| ID | Building | Floor / Zone | Noise | Seating | Outlets | Fill tendency | Notes |
|---|---|---|---|---|---|---|---|
| PP-2 | Public Policy | 2nd Floor | quiet | desks (2 large), chairs | **good** | usually_taken | Two large desks w/ outlets. Little total space; arrive early. Described as "mid noise level, usually quiet" — treat as quiet with variance. |
| PHY-2 | Physics | 2nd Floor | UNKNOWN | tables | UNKNOWN | UNKNOWN | Minimal data. "Some tables" only. |
| PHY-34 | Physics | 3rd / 4th Floor | mid | tables, balcony | UNKNOWN | usually_taken | Balcony w/ table; explicitly nice in summer. Near classrooms so not fully quiet. Arrive early. |
| ILSB-1 | ILSB | 1st Floor | loud | tables | UNKNOWN | varies | Center tables usually taken; **seats around the windows usually open**. Classrooms on this floor. |
| ILSB-2 | ILSB | 2nd Floor | UNKNOWN | tables, study rooms | UNKNOWN | reliably_full | **Study rooms require advance reservation and are always full.** Tables toward the end usually taken. |
| CMN-1 | Commons | 1st Floor (main dining) | loud | tables | UNKNOWN | varies | Always loud. **Opens up near Commons close time** — lots of space then. |
| CMN-G | Commons | Ground Floor (Dunkin area) | loud | tables (many) | UNKNOWN | varies | Tables by the stairs sometimes open. Near the piano — noise source. |
| CMN-2-GAME | Commons | 2nd Floor — near Game Room | quiet | UNKNOWN | UNKNOWN | usually_open | The quiet half of the 2nd floor. |
| CMN-2-SUSHI | Commons | 2nd Floor — near Sushi Do | loud | UNKNOWN | UNKNOWN | usually_taken | The loud half. High foot traffic. |
| RAC-ENT | RAC | Entrance | mid | tables | UNKNOWN | usually_taken | Few spots total. |
| RAC-2 | RAC | 2nd Floor (entrance floor), far end toward Taekwondo room | UNKNOWN | tables | UNKNOWN | UNKNOWN | Alan lists 2nd floor as the entrance floor — verify whether RAC-ENT and RAC-2 are the same physical space. |
| ADM-ALL | Administration | Building-wide (no floor split given) | quiet | desks | UNKNOWN | **reliably_open** | **Desks all around the building; almost always at least one spot free.** Near vending machines and the Admin Coffee Shop. |
| ITE-1 | ITE | 1st Floor | quiet | UNKNOWN | UNKNOWN | varies | Spots near classrooms. |
| ITE-24 | ITE | Floors 2–4 (study areas) | quiet | UNKNOWN | UNKNOWN | varies | Alan rates these highly. Sometimes full. |
| ENG-1 | Engineering | Entrance Floor | quiet–mid | booths | UNKNOWN | usually_open | "Almost never loud." Vending machines. |
| ENG-23 | Engineering | Floors 2–3 | quiet–mid | tables (small) | UNKNOWN | **usually_open** | **"Almost never too full."** Spots near classrooms. |
| UC-2 | University Center | 2nd Floor | mid–loud | tables | UNKNOWN | varies | Tables along the entrance. Heavy through-traffic. |
| UC-3 | University Center | 3rd Floor | mid–loud | tables | UNKNOWN | varies | Same pattern as UC-2. See `SH-3` — possible overlap. |
| UC-FOOD | University Center | Inside Chick-fil-A / Starbucks seating | loud | tables | UNKNOWN | UNKNOWN | Loud by nature. Ties to existing dining rows. |
| PAB-ALL | Performing Arts | Building-wide | quiet–mid | UNKNOWN | UNKNOWN | UNKNOWN | **Low confidence — Alan flags this as thin data.** Modern building, few options. Needs a dedicated visit. |
| FA-ALL | Fine Arts | Building-wide | mid–loud | UNKNOWN | UNKNOWN | UNKNOWN | Old building. Spots exist only near classrooms, hence the noise. Very limited. |
| MEY-24 | Meyerhoff | Floors 2–4 | quiet–mid | tables (by windows), half-rooms | UNKNOWN | usually_taken | **"Can always find a spot at least."** Some floors have half-rooms with a table by the window. Arrive early for the good ones. |
| SH-3 | Sherman Hall | 3rd Floor | UNKNOWN | tables, **whiteboards** | UNKNOWN | reliably_full | **Newest/most modern space on campus.** Connects across the UC 3rd floor. Typically all taken; sometimes zero spots. |
| SON-UP | Sondheim Hall | Upper levels | quiet | tables, half-rooms | UNKNOWN | **usually_open** | Limited count but **"never too full."** |
| MP-1 | Math & Psychology | 1st Floor | mid–loud | desks w/ cubbies | UNKNOWN | **reliably_open** | Right by classrooms. **"Spot always open."** |
| MP-BASE | Math & Psychology | Base / lowest floor | **quiet** | tables (full-size) | UNKNOWN | **reliably_open** | **"Almost always empty, very quiet."** Highest-value entry in this file — see Part 4. |
| MP-24 | Math & Psychology | Floors 2–4 | UNKNOWN | cubbies, round tables | UNKNOWN | usually_taken | Usually at least one spot. Arrive early. **Fills during midterms/finals** — Alan notes this applies to every campus spot. |
| BIO-UP | Biological Sciences | Upper levels | quiet | tables (large), small spots | UNKNOWN | **usually_open** | Large upper-floor tables typically empty. Very limited option count. |
| CHM-1 | Chemistry | Entrance Floor | UNKNOWN | booths, tables | UNKNOWN | varies | |
| CHM-UP | Chemistry | Upper levels | UNKNOWN | half-rooms (open) | UNKNOWN | usually_taken | "Sometimes hard to find a spot, but worth it if found." |

---

## Part 3 — Verbatim source (unedited)

Preserved exactly as Alan wrote it, including typos. This is the authority if Part 2 is ever in doubt.

```
Public Policy | 2nd Floor | Normal, Be early, thers two large desks with outlets and chairs. Mid noise level, usually quiet. | Not much space but can be good if got there early.

Physics | 2nd Floor | Some tables

Physics | 3rd/4th | Some tables and balcony with table, nice in the summer time, usually taken unles u get there early, its nice not super quiet since its near classrooms.

ILSB | First Floor, Loud, classroomes, loits of tables in the middle tpyically taken, around windows theres seats typically open. 2nd floor, study rooms always full, must reserve before hand, tables towards end typically taken. Most modern building

Commons | First floor, Main dining area, always loud, except when commons towards close time, lots of space open. Ground floor where dunkin is, some tables open by the stairts, something full sometimes taken, lots of tables. Loud, near piano. 2nd floor, loud/quiet, near the Game room its quiet and some spots, near Sushi Do typically loud and alot of people.

RAC | Tables in the entrance, typically mid noise, not too many spots. Tables near the end of the 2nd floor(entrance floor) towards the TaiKwonDo room.

Administration | Typically Quiet, desks ALL around the building, almost always atleast 1 spot, near vending machines. Near Admin Coffee Shop

ITE | Typically Quiet, very good study spots from floor 1-4, sometimes full but study areas in floor 2-4 are quiet and very good. Very good overall, spots near classrooms also.

Engineering | Mid/Quiet, almost never loud, also very good, booths on entrance floor, small tables all along 2nd and 3rd floor, almsot never too full, good spots, vending machines also, spots near classrooms.

University Center | Typically loud to normal, spots on 2nd and 3rd floors, some tables along 2nd and 3rd floor entrance. Decent spots, but a lot of traffic throughout, near chik fil and starbucks. Tables in chik fil and stabucks are loud of course.

Performing Arts building | I dont have too much data but seems like study spot, normal to quiet, not too many options, more modern.

Fine Arts | Old building, but decent spots, spots near classrooms, very limited, normal to loud since all near classrooms.

Meyerhoff | Normal to quiet, Prety good study spots on 2-4 floors, some floor have half rooms with a table near windows. Tables near windows on floors, pretty good study spot, show up early but can always find a spot atleast.

Sherman Hall | Has most modern area on campus recently built, across 3rd floor of university center, good study spots with white boards, tables, etc. Typically all taken, show up early to get spots, sometimes theres no spots.

Sondheim Hall | Decent spots on upper levels, half rooms with tables, limited but never too full. Usually quiet.

Math and Psych | Good study spots, desk with cubbies on first floor, typically normal to loud noise since its right by classrooms, spot always open. Full tables in the base floor, almsot alwyas empty very quiet. Upper floor 2-4 have good spots with cubbies also and round tables, show up early to get spot, usually atleast one spot open, but full around exam/finals of course like every other.

Biological Sciences | Some small spots on upper levels, very limited, big tables around upper floors typically empty, decent and quiet but too many options.

Chemistry Building | Good study spot, has open half rooms in upper levels with booths and tbales on entrance floor, very decent, sometimes hard to find a spot, but worth it if found.
```

**Known transcription issue in the source spreadsheet:** the University Center row used a comma instead of a tab between the building name and its description, collapsing them into a single cell. Corrected above. No data lost.

---

## Part 4 — Open items for `docs/DATA_NEEDED.md`

### Blocking (cannot seed without these)
1. **Coordinates for 13 new buildings.** Public Policy, Physics, RAC, ITE, Performing Arts, Fine Arts, Meyerhoff, Sherman Hall, Sondheim Hall, Math & Psychology, Biological Sciences, Chemistry, Administration (study zones). Building-entrance lat/lng, walked.
2. **Hours for all 13.** None are in the dining or library feeds. All will be `manual:` and must be verified in person or from a UMBC source — not inferred.
3. **Outlets: 27 of 28 zones are `UNKNOWN`.** Only PP-2 has real data. This is the column repeatedly identified as the product's moat, and it is effectively empty. No web source will supply it. One dedicated outlet-and-seating pass is required.

### Conflicts and ambiguities to resolve on the walk
4. **`ENG-1` vs. the existing doc row `Engineering Atrium (?)`.** Alan describes booths on the entrance floor and never uses the word "atrium." Determine whether these are the same space, and delete or rename the guess row accordingly.
5. **`SH-3` vs. `UC-3`.** Alan says Sherman Hall's modern space runs "across 3rd floor of university center." These may be one continuous space, two adjacent spaces, or one space students call by two names. Naming it wrong makes it unfindable in the app.
6. **`RAC-ENT` vs. `RAC-2`.** Alan calls the 2nd floor the entrance floor. Confirm whether these are two zones or one.
7. **Commons floors above 2.** Alan's notes stop at the 2nd floor, but "Commons Top Floor" is already seeded and the Skylight Room sits on the 3rd. The 3rd floor has no study-attribute data from any source.
8. **AOK is absent from this file entirely.** The three seeded AOK rows still have `___` for outlets and seating. Alan's highest-traffic personal study spot is presumably in there — worth asking why it's missing rather than assuming the data doesn't exist.

### Product-relevant observations worth preserving
9. **`MP-BASE` is the single most valuable entry here.** A quiet, full-size-table zone that is *almost always empty* is exactly the answer to "where should I go right now" that no official hours page can produce. Strong candidate for a launch demo and for the resume narrative.
10. **Three other reliably-open zones:** `ADM-ALL`, `ENG-23`, `SON-UP`, plus `MP-1`. These are the app's default recommendations when everything popular is full.
11. **`ILSB-1` window seats open while center tables fill.** Zone-level granularity inside a single floor — the clearest evidence so far that floor-level resolution is sometimes still too coarse.
12. **`CMN-1` empties near Commons closing time.** A temporal pattern, which belongs in the Morning/Midday/Evening/Night chart rather than here.
13. **Finals/midterms saturate everything.** Alan notes this explicitly for `MP-24` and generalizes it. If the app shows all-full during finals week it will read as broken; consider how that period is handled.

### Not covered by this file
14. **The temporal crowd chart is still unfilled for all 28 zones.** This file captures *what a zone is*; the chart captures *when it is busy*. Only Chick-fil-A and True Grit's Retriever Market have chart data so far.
15. **Whiteboards** are confirmed only at `SH-3`. Unknown everywhere else.
16. **Swipe/reservation/department restrictions:** only `ILSB-2` is confirmed (advance reservation). Unverified for all other zones.
