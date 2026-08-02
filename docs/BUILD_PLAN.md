# GritCheck — Build Plan

**The canonical document for this project.** Every architectural decision, design rule, algorithm, and quality bar lives here. If a future session, model, or tool is about to do something that contradicts this document, the document wins — or Alan explicitly amends it. Do not re-derive decisions that are already made here.

- **Product:** GritCheck — live campus conditions for UMBC. Answers one question: *"I'm on campus right now — where should I go?"*
- **Owner:** Alan Calcarian (UMBC CIS, Dec 2028), solo builder. GitHub: `agc000`.
- **Strategic role:** The "real users" project in a three-project portfolio (ApplyOps = backend architecture, AI Archives = infrastructure, GritCheck = product + traction). The resume bullet is usage, not tech.
- **Success metric:** Weekly active users and repeat usage at UMBC. Target: 1,000+ users during fall semester. Secondary: a defensible product story for interviews ("what I shipped, what broke, what I changed").
- **Deadline posture:** Substantially complete and polished by mid-August 2026. Launch window: UMBC fall orientation / first week of classes.

---

## 0. Working agreement for Claude Code (read this first, every session)

1. **Read this document at the start of every session.** Then read only the phase being worked on.
2. **One phase at a time. One task at a time.** Never start phase N+1 while phase N's quality gate is unmet.
3. **MVP discipline:** nothing from §10 (Deferred) gets built, scaffolded, or "prepared for" ahead of its trigger. No speculative abstraction.
4. **The design system (§4) is law, not inspiration.** No new colors, fonts, shadows, or component patterns without amending this document.
5. **Small, natural commits** with imperative messages ("Add spot list sheet with Food/Study tabs"), roughly one commit per completed task below.
6. **Explain like a senior coaching a student.** Alan wants to understand every piece. When making a choice, state the reasoning in one or two sentences.
7. **Ask Alan for data, never invent it.** All UMBC facts (spots, hours, floors, tags, consensus lines, coordinates) come from Alan or from the scraper. Placeholder data must be marked `// PLACEHOLDER — Alan to replace` and tracked.
8. **Quality gate ritual** at the end of every UI phase: run the app, view at 390×844 (iPhone viewport), screenshot, and audit against §4.8's checklist before the phase is called done. Fix what fails. This loop is where quality comes from — do not skip it.
9. **Tone in all product copy:** dry, factual, useful. The mascot appears visually, never "talks" in marketing voice. If a string would be embarrassing screenshotted into a group chat, cut it. (Full rules: §4.7.)
10. **Security defaults:** RLS on every table, no service keys in client code, secrets in env vars, rate limiting on all writes.

---

## 1. Product specification

### 1.1 The one question
A student between classes opens the app and within **5 seconds** knows the best place to go for food or study, and whether to trust that answer. Everything in the product serves this loop; anything that slows it is wrong.

### 1.2 The user loop
```
Need a spot → open GritCheck → glance at Best bet (or browse/filter)
→ go there → 10 min later: "Did it pan out?" one-tap follow-up
→ that answer becomes live data for the next student
```
Reporting is engineered as **reciprocity** (you just benefited; close the loop), not altruism. The follow-up prompt is the **primary** report acquisition channel; the global Update button is tertiary.

### 1.3 Scope contract — v1 SHIPS EXACTLY THIS
- **Two categories:** Food and Study. (Gym is deferred — the data model supports it as a third `category` value with zero migration.)
- **Map-first home** (§4.2): full-screen custom dark map, bottom sheet with Food | Study tabs.
- **Every dining spot and ~15–20 study spots browsable**, each with: live status, freshness, hours, static attributes, consensus line, worth-it %, recent update comments.
- **Best bet:** top row of the sorted list, visually highlighted. The recommendation IS the sort order — no separate recommender UI.
- **Sorts:** Food default "Shortest line" (others: Most worth it, Closest, Closing soon). Study default "Best outlets" (others: Quietest, Most seats, Closest).
- **Filters:** Food: Coffee, Vegetarian, Vegan, Halal, Open late, Meal swipe. Study: Silent, Group OK, Outlets, Whiteboards, Open 24h, Near food. All static attributes — fully functional at zero users.
- **Anonymous updates**, ≤3 taps, no accounts. Food: line (short/normal/long) + optional worth-it (yes/no) + optional ≤80-char comment. Study: crowd (empty/normal/packed) + noise (quiet/normal/loud) + optional comment.
- **Time-decay status aggregation with honest confidence** (§5.4). When live data fades, UI falls back to baseline ("Typical for Tue 2 PM: quiet") and says so.
- **Hybrid data:** scraped official hours (foundation) + seeded static knowledge (Alan) + live updates (students). **The app must be fully useful with zero users.**
- **PWA:** installable, app icon, fullscreen. Web push NOT in v1.
- **Moderation minimum:** flag button on comments; auto-hide at 2 flags; device-ID rate limiting.

### 1.4 Explicit NON-goals for v1 (do not build; see §10)
User accounts/auth · reviews or star ratings · chat rooms · gym category · push notifications · native app · menus · favorites · photos · leaderboards/points (design captured in §13; build stays out of v1) · admin dashboard beyond Supabase Studio · email (no Resend) · historical "popular times" charts (needs weeks of real data — post-launch).

---

## 2. Architecture

### 2.1 Stack (locked)
| Layer | Choice | Why (one line) |
|---|---|---|
| Framework | **Next.js 15+ (App Router), TypeScript** | Alan's daily stack at TechX; SSR spot pages for SEO; Vercel-native |
| Styling | **Tailwind CSS** | Speed + enforces the token system |
| Backend | **Supabase** (Postgres, PostgREST, RLS, Realtime, one Edge Function) | DB-as-API eliminates a server tier; Realtime is the product's core promise for free |
| Map | **MapLibre GL JS** + custom dark-gold style, tiles via **OpenFreeMap** (MapTiler free tier as fallback) | GPU vector map = premium feel; style JSON = brand; $0 with no usage billing |
| PWA | **Serwist** | Maintained Next.js service-worker toolchain |
| Hosting | **Vercel** (Hobby) | Zero-ops, preview deploys |
| Scraper | **GitHub Actions cron + TypeScript script** | Free scheduled compute; upserts hours into Supabase |
| Analytics | **Vercel Analytics** + a tiny `events` table for product events | Enough to measure the launch; no third-party bloat |

**Languages: TypeScript everywhere + SQL** (schema, RLS, aggregation). No Python, no FastAPI, no Docker, no AWS — deliberate; Alan's other projects cover those. The interview line: *"Postgres with RLS is the API; I removed a whole tier."*

*Amended 2026-07-11 (Alan, Phase 3 map kickoff): the map camera uses a **fixed ~30° pitch (non-interactive)**, a deliberate change from the original "pitch off" lock, so hand-authored extruded campus buildings read as dimensional and deliver the Phase 3 "pop" bar. Rotation stays off and the camera stays bounded to campus. Full rule and reasoning in §4.2.*

### 2.2 System shape
```
[UMBC hours pages] --(GH Actions cron, 2×/day)--> [Supabase Postgres]
                                                    │  spots / spot_status_snapshots (scraped+seeded)
[Student browser/PWA] --supabase-js--> PostgREST reads (RLS: public SELECT)
        │                                │
        │<---- Realtime (websocket) -----┘  live status changes push to open clients
        │
        └--updates POST--> [Edge Function: rate-limit by device_id] --insert--> updates table
                                                    │
                              [SQL view: decay-weighted current_status + confidence]
```

### 2.3 Repo layout
```
gritcheck/
  docs/BUILD_PLAN.md          ← this file
  docs/DESIGN_REFERENCE.html  ← mockup v7 (canonical look)
  docs/DATA_NEEDED.md         ← running "Alan provides" checklist
  src/app/                    ← App Router: page.tsx (map home), spots/[slug]/page.tsx (SSR detail)
  src/components/             ← Sheet, SpotRow, StatusBadge, UpdateSheet, MapCanvas, FilterChips, SortMenu
  src/lib/                    ← supabase client, status math (client mirror), types
  supabase/migrations/        ← SQL: schema, RLS, views (checked into git — the schema is code)
  supabase/functions/submit-update/
  scraper/                    ← hours scraper + fixtures + tests
  public/                     ← icons, manifest, map-style.json
  .github/workflows/scrape-hours.yml
```

---

## 3. Data model

### 3.1 Tables (initial migration)
```sql
-- Places with live status. One row per *zone* (floor-level granularity is the moat).
create table spots (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,              -- 'ilsb-2nd-floor'
  name text not null,                     -- 'ILSB — 2nd Floor'
  category text not null check (category in ('food','study')), -- 'gym' later
  building text not null,
  lat double precision not null,
  lng double precision not null,
  attributes jsonb not null default '{}', -- see §3.2
  consensus text,                         -- one editorial sentence (§3.3)
  baseline jsonb not null default '{}',   -- typical conditions by day-part (§3.4)
  active boolean not null default true,
  frozen boolean not null default false,  -- §5.5 kill switch: pin spot to baseline-only during abuse
  created_at timestamptz not null default now()
);

-- Scraped or manual open hours, replaced per scrape run.
create table spot_hours (
  id bigint generated always as identity primary key,
  spot_id uuid not null references spots(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  opens time not null,
  closes time not null,                   -- may cross midnight; scraper normalizes
  source text not null default 'scraped', -- 'scraped' | 'manual'
  scraped_at timestamptz not null default now()
);

-- Anonymous student updates. Append-only.
create table updates (
  id bigint generated always as identity primary key,
  spot_id uuid not null references spots(id) on delete cascade,
  device_id uuid not null,                -- random UUID in localStorage; not identity
  kind text not null check (kind in ('food','study','followup')),
  line text check (line in ('short','normal','long')),
  worth_it boolean,
  crowd text check (crowd in ('empty','normal','packed')),
  noise text check (noise in ('quiet','normal','loud')),
  comment text check (char_length(comment) <= 80),
  hidden boolean not null default false,  -- moderation
  flags int not null default 0,
  created_at timestamptz not null default now()
);
create index on updates (spot_id, created_at desc);

-- Product analytics, write-only from client.
create table events (
  id bigint generated always as identity primary key,
  device_id uuid,
  name text not null,                     -- 'open_app','view_spot','submit_update','followup_shown','followup_answered'
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

### 3.2 `attributes` JSONB (static; Alan seeds once; filters read these)
Food: `{ "coffee": bool, "vegetarian": bool, "vegan": bool, "halal": bool, "open_late": bool, "meal_swipe": bool, "mobile_order": bool }`
Study: `{ "silent": bool, "group_ok": bool, "outlets": "good"|"limited"|"bad", "whiteboards": bool, "open_24h": bool, "near_food": bool, "seating": "tables"|"couches"|"mixed" }`

### 3.3 Consensus line
One sentence per spot, Alan's editorial voice, quoted style in UI: *"Sweetest coffee on campus. Fastest line before 10am."* Stored as plain text so its **source can evolve** (manual → data-derived → LLM-summarized, §10) with zero UI change. Rules: ≤90 chars, present tense, specific, never cute.

### 3.4 `baseline` JSONB (the zero-users fallback)
Typical conditions by day-part, seeded by Alan from lived knowledge:
```json
{ "mon-fri": { "morning": "quiet", "midday": "packed", "afternoon": "normal", "evening": "quiet" },
  "sat-sun": { "all": "empty" } }
```
Shown as "Typical for Tue 2 PM: packed" whenever live confidence is low. Honesty here is a trust feature, not a disclaimer.

### 3.5 Row Level Security (non-negotiable)
```sql
alter table spots    enable row level security;
alter table spot_hours enable row level security;
alter table updates  enable row level security;
alter table events   enable row level security;

create policy "public read spots"   on spots      for select using (active);
create policy "public read hours"   on spot_hours for select using (true);
create policy "public read updates" on updates    for select using (not hidden);
create policy "insert events"       on events     for insert with check (true);
-- NO insert policy on updates for anon: writes go ONLY through the Edge Function
-- (service role), which enforces rate limits. No update/delete policies anywhere.
-- Scraper uses service role key stored as a GitHub Actions secret.
```

---

## 4. Design system (law)

Canonical reference: `docs/DESIGN_REFERENCE.html` (mockup v7). When in doubt, open it.

### 4.1 Tokens
```
--black:#121110  --map-bg:#191813  --ink:#EFEEE9   --sheet:#141A28
--gold:#FFC20E   --gold-soft:rgba(255,194,14,.12)
--line:#242C3E   --soft:#1B2232   --muted:#99A0B2  --faint:#7E869A
--go:#2CB56E     --hold:#D9952E   --skip:#E25B47   --closed:#828A9C
Type: "Avenir Next" (Apple system font) with Figtree (webfont) fallback for UI;
      Spline Sans Mono for timestamps/data only.
Radii: 12px sheet, 8px cards, 6px controls, 6px chips/sort (rounded-md).
Spacing on a 4px grid.
```
*Amended 2026-07-10 (Alan, phone-gate review): type was Archivo, radii were 20/12–14.
Avenir Next cannot be self-hosted (Apple license) — Figtree is the matched fallback
non-Apple devices load. Mockup v7 predates this amendment; §4.1 wins where they differ.*
*Amended 2026-07-10 (Alan, "sharper, no bubble"): radii tightened to 12/8/6, and
filter chips + sort button de-pilled from 999px to 6px rounded-rectangles — the
"utility tool, not consumer bubble app" direction. Status dots stay circular
(semantic). Confirmed: the design system has NO gradients anywhere; flat fills only.*
*Amended 2026-07-11 (Alan, Phase 3 "navy sheet"): sheet flipped from white
(#FFFFFF) to UMBC-dining navy (#141A28); ink and the neutral ramp flipped
light-on-dark; status colors brightened for dark-surface contrast; gold-soft
raised to .12 for visibility on navy. Reasons: map↔sheet cohesion (the white
sheet had a hard seam against the dark map), gold signals read stronger on
navy, and the dark-navy UI is already campus-familiar from dineoncampus.
Component consequence: the segmented-control thumb is now the elevated --line
surface (a white thumb vanishes on navy), active label --ink. The §4.8
contrast audit must be re-run against the dark palette before phase close.*
*Amended 2026-07-14 (Alan, logo system — docs/GritCheck Logo System-print.pdf):
the brand mark is **the Check-Pin** — one solid pin, checkmark as negative
space, gold on navy (navy on light for print). Lockup: "Grit" 700 / "Check"
400 in **Space Grotesk + one gold dot full stop — Space Grotesk is the lockup
font ONLY, never UI text** (UI stays Avenir Next/Figtree). The pin replaces
the Grits dog-face as logo/app icon; Grits remains the mascot for empty
states, 404, and marketing art (§4.7 unchanged in spirit: mark ≠ mascot).*
Gold is a **signal**, not decoration: Update button, active filter state, Best bet wash, selected building. If gold appears anywhere else, it's wrong. Green/amber/red/gray appear **only** as status colors.

### 4.2 Screen architecture (locked, from v7)
- **Home = full-screen MapLibre map** (custom dark-gold style, locked to campus bounds, **rotation disabled, pitch fixed at ~30° and non-interactive**) with buildings as tap targets; status glow halos on active buildings.

  *Amended 2026-07-11 (Alan, Phase 3 map kickoff): "pitch/rotation disabled" → "rotation disabled, pitch fixed ~30°, non-interactive." Reasoning, deliberately weighed against the §12 Phase 3 glanceability/LCP rationale for the original lock: (1) **Glanceability is preserved** — the pitch is fixed and the user cannot move the camera, so there is still exactly one canonical view; what the original lock protects against is user-controlled tilt/rotate (disorienting, breaks "one glance = one decision"), not a single authored angle. (2) **The angle is load-bearing for the product's feel** — MapLibre `fill-extrusion` only reads as 3D when the camera has pitch; at pitch 0 building height is invisible. A fixed ~30° is what makes the hand-authored campus buildings "pop," the explicit Phase 3 "cool" bar. (3) **The LCP/Core Web Vitals cost is bounded and gated, not assumed** — extrusion over a small bounded campus scene is a measurable cost, and Phase 3's exit already requires Lighthouse perf ≥85 with the map mounted; the fixed pitch lives or dies by that gate. (4) **The two properties that most protect orientation and performance — rotation off and camera bounds — are untouched.***
- **Bottom sheet** over the map: drag with snap points at ~15% (peek), ~55% (default), ~90% (full). Grabber bar. Momentum + rubber-banding. Use a maintained sheet library; do not hand-roll physics.
- Sheet contents top-to-bottom: **Food | Study segmented control** (sliding thumb) → **filter chips row + sort menu** → **list**.
- **List rows (Beli style):** no card boxes; hairline dividers; name + sub-line left; status word with dot + freshness mono right. **One glance = one decision** — a plain row carries name, ONE status word, freshness, and nothing else.
- **Best bet:** first row, gold-soft wash, star + "BEST BET" microlabel, consensus line included. This row IS the recommender.
- **Update button:** floating gold pill, bottom-right, riding above the sheet edge. Icon + "Update".
- **Spot detail** (tap a row or building): status + confidence bars, "as of X min ago", hours today, attribute chips, consensus line, worth-it %, recent comments (with flag affordance), and an inline "How's it right now?" update prompt.
- **Update flow:** bottom sheet, ≤3 taps: (1) geolocation pre-selects nearest spot — "You're near True Grit's — how's it looking?" with a change-spot escape hatch; (2) one tap per field, huge targets; (3) done, sheet dismisses with subtle confirmation. Comment field visible but never required, never focused by default.
- **Follow-up prompt:** if the user viewed a Best bet / spot detail and ~10 min elapse (app re-open or visibility change), show a one-tap bar: "Did ILSB pan out?" [Yes, good / Meh / Packed]. Answers insert as `kind='followup'` updates. Cap: max 1 prompt per session; never nag.

### 4.3 Status verdicts (UI words, not raw data)
Food: `Short line / Normal line / Long line / Packed / Closed`. Study: `Quiet / Seats open / Filling up / Packed / No recent data / Closed`. Verdict word + color; details live in the detail view.

*Amended 2026-07-17 (Alan, line scale): the update flow collects `line` as a
**1–10 score** (1 = walk right up, 10 = out the door) via a **slider on a
green→amber→red gradient track** — the ONE sanctioned gradient in the app,
carved out of §4.1's flat-fill rule because it encodes the scale itself
(semantics, not decoration; the ban targets decorative gradients). Readout
number wears the band color: 1–3 go · 4–6 hold · 7–10 skip. Stored raw as
`smallint` (§3.1 migration 20260717000400). Display stays these §4.3 words
via the same banding — rows never show raw numbers. Aggregation stays §5.2's
weighted band-vote, deliberately NOT a weighted mean: a mean lets one false
extreme drag the number, the vote keeps a lone lie outvoted (§5.5). This
also settles the previously flagged mockup deviation: Normal line renders
hold-amber.*

*Extended same day (Alan, consistency pass): **crowd** (1 empty → 10 packed)
and **noise** (1 silent → 10 loud) join line on the identical slider +
banding system (migration 20260717000500) — one input language across every
field. Two flow changes ride along: (1) geolocation pre-select is now
**building-scoped** — GPS can place you at a building but never on a floor,
so when the nearest building holds several zones (AOK's five), the sheet
asks "You're at AOK Library — which one?" instead of guessing a floor; (2)
the **Check-Pin mark heads every update surface** (FAB, update sheet,
detail inline prompt, follow-up bar) — the mark should mean "report what
you see".*

### 4.4 Freshness display
< 60 min: "8 min ago" (mono, small). 1–3 h: "2 h ago" in `--hold` tone. Older/none: show baseline — "typical: quiet". **Never present stale data as current.**

### 4.5 Confidence
Three bars driven by §5.4's weight sum: 3 = High, 2 = Medium, 1 = Low ("based on typical pattern"). Always accompanied by the reason: "4 reports this hour" / "no reports since 11 AM".

### 4.6 Motion & feel
Transitions 150–200ms ease-out; sheet snap ~250ms. Respect `prefers-reduced-motion`. Tap feedback via scale(.97–.98). No skeleton shimmer — content renders from cache instantly (§6 Phase 5).

### 4.7 Voice
Dry, specific, zero exclamation marks, zero emoji in UI chrome. Grits (the Chesapeake Bay Retriever) appears as: app icon, logo mark, empty states, the 404 page — **visually only**. Litmus test: screenshot-into-groupchat embarrassment = cut.

### 4.8 Quality gate checklist (run at the end of every UI phase)
390×844 viewport screenshot audit: 4px-grid spacing? Type scale consistent (no orphan sizes)? Gold only as signal? One status word per row? Tap targets ≥44px? Text contrast ≥4.5:1? Sheet drag smooth on a real phone (Alan tests on his iPhone in Safari — not just desktop)? Lighthouse PWA + performance ≥90 (Phase 5+)? Anything that looks "AI-generated default" (uniform rounded cards, gratuitous shadows, gradient buttons) — kill it.

---

## 5. The clever bit: status aggregation

This is the project's one deliberately sophisticated algorithm. Implement it in SQL exactly as specified; mirror the same math in `src/lib/status.ts` for optimistic client updates.

### 5.1 Decay weighting
Each update's weight: `w = exp(-Δt_minutes / τ)`, with **τ = 45 for food** (lines change fast), **τ = 90 for study** (rooms change slower). Updates older than 3 h are ignored entirely.

### 5.2 Aggregated status
Per spot, per field (line/crowd/noise): weighted vote — sum weights per value, take the max. Worth-it %: weighted share of `worth_it = true` over trailing **7 days** (slow-moving quality signal, deliberately different window).

### 5.3 Confidence
`W = Σ w` over the 3 h window. **W ≥ 2.0 → High. 0.8 ≤ W < 2.0 → Medium. W < 0.8 → Low** → UI shows baseline as primary with "typical" framing. (Tune thresholds with real data in week 2 of launch; log them as constants, not magic numbers.)

### 5.4 SQL implementation
A view (or function) `spot_current_status` computing: latest weighted verdict per field, W, confidence bucket, last_update_at, open/closed from `spot_hours` vs `now()` (America/New_York; handle hours crossing midnight). Client reads this view; Realtime subscription on `updates` triggers a refetch of the affected spot. **Guardrail (found in mockup review): a "quiet" update from 11 AM must never render as current at 3 PM.** Write a pgTAP-style or scripted test asserting the 3 h cutoff and the τ curve at 15/45/90/180 min.

### 5.5 Anti-abuse & threat model (Edge Function `submit-update`)
**Platform security posture:** no accounts → no credentials to steal; no PII (device UUID only); RLS denies all writes outside the Edge Function and all updates/deletes everywhere; secrets live in env vars / GitHub Actions secrets, never in client code; comments render as escaped React text only — `dangerouslySetInnerHTML` is banned repo-wide; every payload is validated server-side with zod (shape, enums, 80-char comment cap) before insert.

**Rate limits — two independent keys, both enforced in the Edge Function:**
1. Per **device**: 1 update per spot per 10 min; 12/day.
2. Per **IP**: 3 updates per spot per 10 min; 30/day. (Defends against the sybil hole: clearing localStorage mints a new device ID, but rotating IPs on a phone is costly. Read the IP from the request headers server-side; store hashed.)

**False-report (data poisoning) model — why a lie is weak by design:** status is a decay-weighted *vote*, so one false report is outvoted by any honest one; a lone report is labeled "Low confidence · 1 report this hour," never presented as truth; it decays toward baseline within ~1 h (§5.1); and follow-up prompts from students who went anyway generate corrective data. The attacker's payoff (mildly misleading strangers about a lunch line) is far below the effort of sustaining it. 

**Escalation tools (build in Phase 4, hope to never use):**
- `spots.frozen = true` → aggregation view ignores live updates and serves baseline-only with "typical" framing. Flipped in Supabase Studio in under a minute — the incident response for a brigaded spot.
- Comment flags: `flags >= 2 → hidden = true` via a `security definer` SQL function, rate-limited like updates.
- **Cloudflare Turnstile** (free, invisible bot check) is a §10 trigger *only if* scripted abuse is actually observed — every defense taxes honest 3-tap reporters, so proportionality is the principle: make lying tedious and self-correcting, detect brigading, respond in a minute. This is not Fort Knox for a lunch-line app, and that is a deliberate, defensible engineering judgment.

---

## 6. Phases

Every phase ends with: quality gate (if UI), commits pushed, and a one-paragraph "what exists now" note Alan can verify. **Bold items in "Alan provides" block the phase — collect them early.**

### Phase 0 — Data recon & seed dataset (no code against Supabase yet)
**Goal:** know exactly what UMBC publishes and produce the seed file. 
Tasks: fetch UMBC dining-hours and library-hours pages; determine format (HTML tables / embedded JSON / PDF); write `scraper/fixtures/` snapshots + a parse spike proving extraction; author `docs/DATA_NEEDED.md`; produce `scraper/seed/spots.json` — the complete spot list with all §3 fields.
**Alan provides:** **URLs of every UMBC hours page**; **the full spot list** (every dining option; 15–20 study zones with floor granularity); **per-spot: building, approx lat/lng (Google Maps right-click), attributes, consensus line, baseline patterns**; walk-time anchor points.
**Exit:** seed JSON validates against a zod schema; parse spike extracts real hours from fixtures.

### Phase 1 — Foundation: repo, Supabase, schema, seed
Tasks: Next.js scaffold (if not already) + Tailwind tokens from §4.1; Supabase project; migration files for §3 schema + RLS + `spot_current_status` view; seed script loading `spots.json`; typed supabase-js client + generated DB types; CI workflow (lint + typecheck + tests on every push — red CI blocks the phase); deploy skeleton to Vercel; connect domain.
**Alan provides:** Supabase account, Vercel account, **purchased domain**.
**Exit:** production URL serves a page listing seeded spots from the DB (ugly is fine); RLS verified by attempting a forbidden write from the browser console and watching it fail.

### Phase 2 — The sheet: browse experience (UI core)
Tasks: bottom sheet with snap points; Food|Study segmented control; SpotRow + StatusBadge + freshness per §4; Best bet treatment; filter chips wired to `attributes`; sort menu with §1.3 defaults; spot detail route (SSR) with hours/attributes/consensus; empty-state and closed-state handling. Map is a static dark placeholder this phase.
**Exit:** quality gate §4.8 passes on Alan's phone; every seeded spot browsable and filterable with baseline statuses.

### Phase 3 — The map
Tasks: MapLibre with OpenFreeMap tiles; custom style JSON (dark charcoal base, muted labels, gold accent on campus buildings — style the JSON by hand, this is brand work); camera locked to campus bounds, rotation/pitch off; spot markers colored by status with glow for active; building/marker tap → opens sheet to that spot; recenter control; graceful fallback (list still fully works if tiles fail).
**Alan provides:** confirmation of final lat/lng per spot (walk campus with the dev build).
**Exit (amended 2026-07-15, Alan — supersedes the prior "Lighthouse perf ≥85" numeric gate):**
map feels premium (the "cool" bar); tap-through works; **core answer server-painted
≤2.5s on slow-4G mobile (LCP), CLS 0, A11y/BP/SEO 100/100/100; absolute PSI perf
score documented (63, dominated by map-runtime main-thread cost).**
*Reasoning: the gate's intent was "the map must not wreck the 5-second answer."
Intent is met — the answer is server-painted (SSR twin) before the map boots
(LCP 5.7s → 2.5s, CLS 0). We are deliberately not chasing 85 against an
indivisible vendor chunk.*
**DEBT — TBT ~2,440ms:** MapLibre parse/eval + React hydration. NOT addressed by
SW caching (caching skips fetch, not execution) — paid on every load, cached or
cold. Mount is already double-deferred (`next/dynamic ssr:false` + idle-gated,
so eval does not contend with list hydration on Chromium); two known soft spots:
the 4s idle-timeout cap can force contention on very slow devices, and Safari's
600ms fallback timer (no rIC) can land mid-hydration on older iPhones. Revisit
via interaction-gated mount / longer Safari fallback / lower-priority hydration.
**Unowned by any current phase.**
**DEBT — pre-launch data pass (moved out of this gate):** walked lat/lng
confirmation; ILSB + Engineering coords; on-foot outlets/seating pass.
**Phase 3 CLOSED 2026-07-15.**

### Phase 4 — Live layer: updates, decay, Realtime
Tasks: Edge Function `submit-update` with §5.5 limits + tests; Update sheet flow (§4.2) with geolocation pre-select; decay view live → rows show real verdicts + confidence; Realtime subscription updating open clients; follow-up prompt mechanic; comment display + flag/auto-hide; `events` instrumentation for the §8.4 metrics.
**Exit:** two devices side by side — an update on one changes the other within 2 s; rate limits demonstrably enforced; the 11 AM-report-at-3 PM guardrail test passes.

### Phase 5 — PWA + performance + SEO
Tasks: Serwist service worker (cache shell + last-known data; offline shows cached statuses with honest staleness labels); manifest + icons (Grits mark) + splash; install prompt UX ("Add GritCheck to your home screen" moment after second visit); SSR/ISR spot pages with metadata ("True Grit's hours & live line — GritCheck"); OG images; sitemap; performance pass to hit the 5-second loop on 4G (target: interactive < 2.5 s repeat visit).
**Exit:** Lighthouse PWA installable + perf ≥90; add-to-home-screen works on iOS Safari; Google can index spot pages.

*Amended 2026-07-23 (Alan, Phase 5 kickoff) — three gate clarifications:*
1. **Perf ≥90 stands; Phase 5 adopts the Phase 3 TBT debt as real work.**
   Decided by measurement, not hope: local Lighthouse (mobile emulation,
   prod build) scores **60 with the map idle-mounted** (TBT 2,780 ms) and
   **94–95 with the map mount disabled** (TBT 10–30 ms, two runs). The
   ceiling is comfortably ≥90 and hydration is innocent — MapLibre eval is
   effectively the entire gap. Remedy (perf-pass task): gate the map mount
   on first interaction with a generous timer fallback, plus the longer
   Safari fallback from the Phase 3 debt note. Feel-check on Alan's iPhone
   is part of the gate — we do not trade the map-first "premium" bar for
   an auditor's number.
2. **"Lighthouse PWA installable" is restated:** Lighthouse removed the PWA
   category in v12 (2024). The check is now: Chrome DevTools installability
   criteria pass + add-to-home-screen verified manually on iOS Safari
   (which was already the exit's hard case).
3. **SSR, not ISR.** Spot pages stay `force-dynamic`: the page's point is a
   live verdict, and ISR-cached statuses would violate §4.4 ("never present
   stale data as current"). Google indexes dynamic SSR pages fine; repeat-
   visit speed comes from the service worker, not from caching the verdict.
   Phase 4 already shipped robots.txt, the dynamic sitemap, metadataBase,
   and favicons — this phase's SEO work is per-spot metadata + OG images.

*Gate results, measured 2026-07-30 (local Lighthouse, prod build, mobile
emulation — NOT yet prod PSI):*

Re-measured on the final build (2026-07-30) after the map/label work and the
analytics split — three consecutive runs, reported as a range because a single
number would be a lie about a noisy metric:

| Metric | Before | After (3 runs) | Gate |
|---|---|---|---|
| Performance (home) | 60 | **94 / 95 / 94** | ≥90 ✅ |
| TBT | 2,780 ms | **10–30 ms** | — |
| LCP / CLS | — | 2.9–3.1 s / **0** | — |
| Accessibility | — | **100** | — |
| SEO | — | **100** | — |
| Best practices | — | 96 (100 in prod) | — |

*Honesty note on variance:* one mid-phase run measured 93 with TBT 100 ms, and
an earlier table here recorded "94 / ~40 ms" from a single run. Once the main
thread is near-idle, TBT is dominated by scheduling noise — 10 ms and 100 ms
are the same engineering result, and both are ~1% of the 2,780 ms we started
from. The range above supersedes the earlier point estimates.

The ≥90 gate was met by *owning* the TBT debt, exactly as amendment 1
committed — not by amending the number. Best-practices 96 loses its points
only to a local-only Vercel Analytics 404 that doesn't exist in production.

**Shipped:** manifest + maskable icons + 10 iOS startup images; Serwist
service worker (`@serwist/turbopack` 9.5.12, iife-compiled for Safari <16.4)
with `/~offline` fallback and an offline banner; the honest clock
(`src/lib/clock.ts`) that makes cached verdicts age instead of lying;
second-visit install prompt; per-spot metadata + branded OG cards; enforced
CSP; interaction-gated map mount.

**Known, deliberately not fixed here:** the spot detail page measures 89
locally (LCP 3.8 s) — `getSpotDetail` runs two sequential query stages and
could collapse to one with PostgREST embedded filters. Logged as a cheap
Phase 7 follow-up rather than churn during gate close; the gate is the home
page, which is the 5-second answer.

*Exit criteria — verified 2026-07-30 (prod build, Chrome via CDP):*

**"Lighthouse PWA installable" (as restated by amendment 2) — PASS.** Every
Chrome installability criterion checked directly: manifest parses with zero
errors; `name` + `short_name`; `start_url: "/"`; `display: "standalone"`;
icons at 192, 512, and maskable; service worker **active and controlling**
at scope `/`. The fetch handler was proven the only way that actually counts
— the browser was put offline and the real app still rendered from cache
(not the fallback page).

**"Google can index spot pages" — PASS.** robots.txt allows all and points at
the sitemap; the sitemap serves 23 URLs (22 spot pages); a spot page returns
200 with a unique title, unique category-aware description, canonical URL,
and OG image; no `noindex`, no `X-Robots-Tag`; and the content is in the raw
SSR HTML, not injected by JS.

**"perf ≥90" — PASS locally**, two consecutive runs on the committed build:
94 / 94, a11y 100, best practices 96, SEO 100, LCP 3.0 s, TBT 10–20 ms, CLS 0.

**"add-to-home-screen works on iOS Safari" — PASS.** Verified by Alan on a
real iPhone, 2026-07-30: installs from the Share sheet and launches
standalone — *"it's like an app."* This was the exit's hard case and the one
criterion no local tooling could vouch for, because iOS ignores the
manifest's install path entirely.

*Production measurement, gritcheck.live, 2026-07-30 (deployed build, mobile
emulation + 4G throttling — Google's keyless PSI API was over quota, so this
is the same Lighthouse engine run against the live origin):*

| | Local | **Production** |
|---|---|---|
| Performance | 94 | **91** ✅ ≥90 |
| Accessibility | 100 | **100** |
| Best practices | 96 | **100** |
| SEO | 100 | **100** |
| LCP / TBT / CLS | 3.0 s / 20 ms / 0 | **3.4 s / 50 ms / 0** |

Best practices reached 100 in production because the only local deduction was
a Vercel Analytics 404 that exists solely on localhost. The ~3-point
performance delta is real-network cost (FCP 1.0 s, Speed Index 2.8 s), and
the gate holds with margin on the hardware students will actually use.

**Amendment-1 feel-check — PASS** (Alan, real iPhone, 2026-07-30: "feels
smooth"). This bar was written into the gate deliberately so a good score
could never buy a worse-feeling app, and it earned its place: the first
interaction-gated mount scored perfectly while making the first sheet drag
stutter, and only a human dragging a sheet caught it.

### ✅ PHASE 5 CLOSED — 2026-07-30

Every exit criterion met on production hardware: installable (Chrome criteria
+ real iPhone add-to-home-screen), perf **91** on gritcheck.live against a
≥90 gate, spot pages indexable. The phase's defining decision was refusing to
amend the gate: it opened with a measured 60 and a 2,780 ms TBT debt that
caching provably cannot fix, and closed by owning that debt instead of
rewriting the number. §12 Q+A recorded above. **Next: Phase 6.**

### Phase 6 — Scraper in production + hardening
Tasks: finalize scraper from Phase 0 spike — dining runs **Playwright/headless Chromium in GH Actions** and intercepts the dineoncampus JSON API (`apiv4.dineoncampus.com`; Cloudflare TLS fingerprinting 403s plain fetches, a real browser passes clean), library uses **LibCal's open JSON API** (`api3.libcal.com/api_hours_grid.php?iid=991`, plain fetch); **re-capture both fixtures in late August** — the Phase 0 snapshots are summer session with most venues closed all week; GH Actions cron (2×/day, plus manual dispatch); upsert with `source='scraped'`, keep `manual` overrides winning; failure alerting (Action failure → GitHub notification is enough); scraper unit tests on fixtures; error boundary + minimal logging in app; legal footer ("unofficial, built by a UMBC student"), simple privacy note (anonymous device ID, no accounts, no PII).
**Exit:** hours update end-to-end from UMBC's site with no human touch; a deliberately broken fixture fails loudly, not silently.

### Phase 7 — Polish sprint + private beta
Tasks: full §4.8 audit of every screen; copy pass (§4.7); micro-interactions; 404/offline/empty states with Grits; seed **fresh real data week** (Alan updates statuses himself daily so the beta never looks dead); recruit 10–20 friends as beta users; fix the top 5 friction points they hit; tag `v1.0.0`.
**Alan provides:** beta testers; a week of self-seeded updates; final consensus-line pass.
**Exit:** a stranger handed the URL can install it, get a useful answer, and submit an update without explanation.

*Carried into Phase 7 from Phase 5 (logged 2026-07-30, deliberately NOT built):*

- **Realtime fan-out — filtered subscription.** `LiveRefresh` subscribes to
  *every* INSERT on `updates` with no filter, and each one fires
  `router.refresh()` on a `force-dynamic` page — a full server render plus
  three Supabase queries. So the cost scales as **concurrent clients ×
  update rate**, not as users: 150 concurrent students at lunch with 10
  updates/min is ~1,500 SSR renders and ~4,500 queries per minute, to tell
  each client about a spot they mostly aren't looking at. It also multiplies
  the Realtime *message* quota against the same plan ceiling as connections,
  so both limits are consumed by one design.
  This was the right call at 22 spots and zero traffic — per-spot patching
  across three trees costs more than it saves until the load is real — and
  it is written in the file as such.
  **Trigger:** if Supabase's *Realtime Peak Connections* shows a sustained
  peak above **120** (the free tier's ceiling is 200), ship the filtered
  subscription that week. Fix is an afternoon: filter server-side to the
  spots actually on screen, or carry the changed row's status in the channel
  payload so no refetch is needed. Do not pre-build it (§0.3).

- **Spot detail page perf.** 89 locally (LCP 3.8 s): `getSpotDetail` runs two
  sequential query stages that PostgREST embedded filters could collapse into
  one round trip.

- **Back-nav resets browse state** — tab/filter/sort are component state;
  restoring them needs URL params.

*Added to Phase 7 from Phase 6 (Alan, 2026-08-02 — raised mid-Phase-6, logged
rather than built, per §0.2 and the drift lesson recorded above):*

- **Map placeholder needs a label.** The map region is unlabelled until the
  map mounts, so a first-time student sees brand-coloured emptiness with no
  account of what it is. The obvious fix — a "Loading Map…" spinner — is
  **wrong here**, and the reason is worth keeping: the map deliberately does
  not mount until the user's first gesture *ends*, in an idle slot (§Phase 5
  perf architecture; mounting on `pointerdown` made the first sheet drag
  stutter). So for anyone who lands and reads the sheet without touching
  anything, a loading label would sit there forever and read as broken rather
  than as pending. The honest treatment is a **static labelled placeholder**
  in the brand backdrop that invites the gesture, switching to a genuine
  loading state only once mounting has actually begun. Two states, not one.
  Belongs with the §4.8 audit at 390×844 — it is a real component, not a
  string swap. Do not "fix" it by mounting the map eagerly (§Phase 5 item 6).

- **Copy pass to a ~5th-grade reading level** (folds into the existing §4.7
  copy-pass task). Alan's framing: the app must never make the answer harder
  to reach than the walk. This does not conflict with §4.7 — "dry, factual,
  no exclamation marks" and "plain enough for a tired student at 11 PM" pull
  the same direction; plain is the point, terse is the method. Run it over
  every screen at once: piecemeal edits mean auditing the same strings twice,
  and consistency of voice is most of what makes copy feel considered.

*Accepted scope drift, recorded 2026-07-30 (Phase 3 map work that shipped
during Phase 5 without a written amendment at the time):* the Find Building
tab, footprint highlighting on tap, the curated `studyCapable` property, and
the OSM POI label layer with its class/name filters are all §Phase 3 map
scope. They were built in Phase 5 in response to live feedback while the map
was already open on screen. Recorded rather than relitigated — but the
pattern (map polish arriving mid-phase) is worth watching, since it is
exactly how a phase's exit criteria drift out from under it.

---

## 7. Launch & marketing playbook (college-specific)

Principles: **authenticity beats polish** on campus (the winning story is "a UMBC student built this," not a brand); **utility content markets a utility app** (show it being right); **borrow trust** (RAs, club officers, oriented freshmen) rather than buying attention. Detailed content/scripts are a later working session with Alan — this section locks strategy and calendar.

### 7.1 Pre-launch (August)
Landing page live at the domain with install CTA. Handles secured: IG `@gritcheck` (or `@gritcheck.umbc`), TikTok same. Seed content batch: photograph/video every spot (b-roll bank). Write the r/UMBC launch post draft. Print QR table tents + stickers (QR → site with `?src=qr-{location}` for attribution). Soft outreach: RAs Alan knows, club Discord admins, CS/IS groupchats — ask for day-one shares, not vague support.

### 7.2 Launch week = orientation week (the whole ballgame)
- **r/UMBC post:** builder story, screenshots, direct link, explicit "it's free, no accounts, I want feedback." Reply to every comment for 48 h. (Reddit rewards maker-posts and punishes anything ad-shaped.)
- **Fizz:** no ads — be *useful*. Post live-condition screenshots at high-pain moments ("Grit's line rn 💀 — checked on gritcheck"). Anonymous-adjacent culture; the app should feel like a Fizz-native tip, not a promo.
- **QR placement:** dining tables, library floors, ILSB, UC boards (get RA/desk permission — also builds allies).
- **TikTok/IG formats (3–5 clips ready before launch):** (a) POV: skipping the Grit's line because the app said Halal Shack; (b) "I built an app for UMBC students" build-story arc; (c) "ranking UMBC study spots" using app data. Post at class-change times.
- **The physical move:** orientation events, tabling if possible; "scan this, it tells you where the short lines are" is a 5-second pitch that demos itself.

### 7.3 Retention engine (weeks 2–8)
Weekly "State of Campus" IG/TikTok post from real data (busiest spot, most worth-it, hidden gem) — the app generating its own content. Follow-up prompt quality is the #1 retention lever; watch its answer rate. Respond visibly to feedback ("you asked, added X") — campus apps win on the builder being *present*. Recruit 3–5 power reporters (friends in high-traffic buildings) to keep data warm through the post-novelty dip the AI-council predicted at weeks 2–4 — expect the dip, fight it with freshness, don't panic.

### 7.4 Metrics that matter (check weekly, in `events` + Vercel Analytics)
WAU; D7 return rate; updates/day and % from follow-up prompts vs global button; % of sessions reaching a spot detail in <10 s; QR-source installs. Vanity metrics (raw pageviews, TikTok likes) get logged but never drive decisions.

---

## 8. Scale & cost posture
Fixed cost: domain (~$15/yr). Everything else $0 at launch. Upgrade triggers, not dates: **Supabase Pro ($25/mo)** when real daily users exist (backups become the real reason) · error monitoring (Sentry free tier) at first crash report Alan can't reproduce · Vercel Pro only if traffic vastly exceeds one campus. Realtime free ceiling = 200 concurrent connections — a good problem; the fix is a Pro upgrade, not a rewrite. Nothing in this stack bills per-use in a way a viral moment could turn into a surprise invoice.

---

## 9. Risk register (from the AI-council review + design sessions)
| Risk | Mitigation baked into this plan |
|---|---|
| Cold start / sparse coverage | Zero-user usefulness (baseline + hours + attributes); Alan self-seeds week 1; power reporters |
| Stale data = misinformation | Decay + 3 h cutoff + honest confidence + baseline fallback (§5) |
| Weak reporting incentive | Follow-up reciprocity prompt as primary channel; 3-tap ceiling; geolocation pre-select |
| Post-novelty retention cliff (wk 2–4) | Dining as daily anchor; §7.3 engine; measure D7 and react, don't guess |
| Trolling / false reports / sybil | Weighted voting outvotes lies; honest confidence labels; dual device+IP rate limits; flags + auto-hide; per-spot freeze switch; Turnstile as observed-abuse trigger (§5.5) |
| Scraper breaks silently | Fixture tests + loud CI failure (§Phase 6) |
| Scope creep | §1.4 + §10 are contractual; Claude Code agreement §0.3 |
| UMBC trademark friction | Original mascot (Grits ≠ Chip), "unofficial" footer, no UMBC logos; pitch SGA for blessing post-launch |

## 10. Post-traction unlocks (triggers, not promises)
Historical "popular times" charts (≥3 wks of data) · Gym/RAC category (≥500 WAU or loud demand) · Web push "tell me when RAC empties" (≥1,000 installs) · LLM-derived consensus lines from comments (≥50 comments/spot — strong resume feature) · spot activity streams → chat (≥500 WAU **and** moderation plan) · Cloudflare Turnstile on updates (only if scripted abuse observed, §5.5) · native/Expo app (only if PWA install friction is provably the bottleneck) · contribution incentive system (design locked in §13; earliest start post-Phase-4, default post-v1.0.0) · other campuses (never before UMBC is won).

## 11. Session prompts for Claude Code
Phase kickoff: *"Read docs/BUILD_PLAN.md §0 and §Phase N. Restate the phase's exit criteria in your own words, list the tasks in order, flag anything in 'Alan provides' that's missing, then start task 1. Small commits."*
Quality gate: *"Run the §4.8 checklist against the current build at 390×844. Screenshot, list failures, fix them, re-verify. Do not declare the phase done until it passes."*
Drift check (any session): *"Does anything in the working tree contradict BUILD_PLAN.md? List contradictions before continuing."*
Phase close: *"Pose me this phase's §12 questions. If my answer is wrong or shallow, explain the concept properly, then re-ask in a new form before marking the phase complete."*

---

## 12. Learning track — Alan is not vibe coding

**Rule:** at each phase close, Claude Code quizzes Alan on that phase's questions below. Alan answers in his own words *before* the phase is marked done. Wrong or vague → teach, then re-ask differently. These are interview-grade on purpose: by launch, every one of these is a story Alan can tell in a FAANG behavioral/technical screen.

**Phase 0:** Why does the *format* of a data source (HTML vs JSON vs PDF) dictate ingestion architecture? What makes scrapers brittle, and what's a "data contract"? Why snapshot fixtures instead of testing against the live site?
**Phase 1:** Explain Row Level Security to someone who's only built Express/FastAPI apps — what tier of code does it eliminate, and what's the tradeoff? Why are migrations checked into git ("schema is code")? What do generated TypeScript types from the DB schema actually prevent?
**Phase 2:** Server components vs client components in the App Router — which parts of GritCheck are which, and why? Where does filter/sort state live and why not in a global store? Why does the recommendation being "the sort order" simplify the whole product?
**Phase 3:** Raster vs vector tiles — what's actually different on the wire and on the GPU? Why lock the camera to campus bounds (name the UX *and* the performance reason)? What's graceful degradation, concretely, when tiles fail?

*Phase 3 ANSWERED (ritual amended 2026-07-15: Q+A recorded together, no grading loop):*

**① Raster vs vector.** On the wire: raster tiles are pre-rendered PNG/JPEG
images — the style is baked in server-side, every zoom level is a fresh image
download, and changing the look means re-rendering the entire tile pyramid.
Vector tiles (MVT/protobuf, what OpenFreeMap serves) are compressed *geometry
with attributes* — points, lines, polygons tagged by layer — and one payload
serves a range of zooms by overzooming. On the GPU: raster tiles are texture
quads (decode, upload, scale — blurry between zooms, restyle impossible);
vector geometry is tessellated into triangles and styled at draw time by
shaders — crisp at any zoom and pitch, restyled instantly, labels re-laid out
client-side. Why it mattered for brand: the entire dark-gold identity is a
hand-authored style JSON applied client-side to open geometry — we own the
look without hosting a single tile. With raster we'd accept someone else's
colors or run our own render farm; and the fixed-pitch extruded buildings are
only possible because the client has real geometry to extrude.

**② The camera lock.** UX: the product answers one question about one campus —
a free camera lets a student fling themselves to downtown Baltimore or zoom
into a parking lot; bounds guarantee every possible frame contains the answer
space, and rotation-off preserves the north-up frame so the map matches the
student's walking memory of campus — that IS glanceability. Perf: a bounded
camera bounds the *tile universe* — campus at z14–18 is a handful of tiles,
so cache stays tiny, fetches stay few, and no texture/geometry churn from
panning the planet; the first view is a predictable, small tile set. Pitch was
amended (fixed 30°, non-interactive) because it's still ONE authored canonical
view — glanceability survives, and extrusions are invisible at pitch 0.
Rotation and bounds were untouched because they carry the two guarantees:
rotation-off = orientation, bounds = the tile/perf budget. The pitch's cost was
measured against the gate, not assumed (LCP 2.5s / CLS 0 with pitch on).

**③ OpenFreeMap dies during orientation week.** The student sees the dark
navy-charcoal brand backdrop where tiles would be — not a broken white frame —
with the wordmark, Update button, recenter, and the full sheet on top. And the
sheet IS the product: list, statuses, filters, sort, detail pages all work,
because product data flows exclusively from Supabase — zero bytes of it
transit the tile server. This was proven, not assumed: with all requests to
openfreemap.org blocked, 16 rows rendered, tabs and navigation worked, zero
page errors (Phase 3 tiles-fail test). Architecturally it's progressive
enhancement: the answer is server-painted HTML; the map is a client-only
island (`ssr:false`, idle-mounted) whose failures cannot propagate into the
sheet's tree. If the outage persisted, §2.1's designated fallback is MapTiler's
free tier — a style-URL swap, not a rewrite.*
**Phase 4 (the big one):** Walk through the full lifecycle of one update: tap → Edge Function → rate limit checks → insert → aggregation view → Realtime push → another student's screen. Why exponential decay instead of a hard time window? Why weighted voting instead of last-write-wins? Fixed-window vs token-bucket rate limiting — which did we use and what's the failure mode? Why websockets instead of polling, and what would polling cost at 200 concurrent users? What's optimistic UI and where is it safe?

*Phase 4 ANSWERED (ritual amended 2026-07-15: Q+A recorded together, no grading loop):*

**① One update's full lifecycle.** A student taps the gold Update FAB; it
dispatches a window event (`OPEN_UPDATE_EVENT`) that the page-level UpdateSheet
listens for — the FAB renders in two places (SSR twin + live drawer) so an
event beats threading props. Geolocation runs *at that tap, not on load*
(§13.2): it pre-selects the nearest open spot, but if that building holds
several zones (AOK's five floors) it asks "which one?" rather than guess a
floor GPS can't resolve. The student drags the 1–10 line slider; on Send the
client attaches a device UUID from localStorage and calls
`supabase.functions.invoke("submit-update")` with the anon JWT. That hits the
Deno Edge Function — the *only* write path into `updates`, because RLS gives
anon no insert policy (§3.5) and the function runs as service_role. The
function: checks CORS origin, zod-validates (shape, 1–10 range, 80-char
comment cap, field/kind coherence), hashes the caller IP with a secret salt
(the raw IP never lands), confirms the spot exists, then runs the §5.5 gate —
four `count` queries against `update_rate_limits` (device/spot/10 min,
device/day, IP/spot/10 min, IP/day). Pass → insert the row, then charge one
quota row (only on success, so moderation never refunds quota). It returns 201.
The client logs a `submit_update` event, shows "Sent.", and refreshes its *own*
view. Meanwhile Postgres streams that INSERT through the `supabase_realtime`
publication (the migration added `updates` to it); every other open client holds
one websocket subscribed to `postgres_changes` on that table. The push fires a
debounced `router.refresh()`, the server re-reads the `spot_current_status`
view — which recomputes the decay-weighted verdict — and the new "Long line"
paints. Measured end to end: ~1.5 s, tap to other phone.

**② Exponential decay, not a hard window.** A pure time window is a cliff: a
report is fully trusted at 2:59 and worthless at 3:01, and *inside* the window
a 5-minute-old report and a 2h-55m-old one count equally — absurd when lunch
lines turn over every few minutes. Decay, `w = exp(-Δt/τ)`, makes trust fade
*continuously*: the freshest report dominates, older ones fade smoothly toward
irrelevance with no discontinuity — which is how real confidence actually
degrades. τ encodes domain knowledge as a constant, not a magic number: food
τ=45 min (lines move fast), study τ=90 min (rooms change slowly). We *also*
keep the 3 h hard cutoff, but it's a compute/relevance floor — drop rows whose
weight is already noise (at τ=45, 3 h old is exp(-4)≈0.018) — not the trust
model. The §5.4 guardrail (an 11 AM "quiet" never reads as current at 3 PM) is
belt-and-suspenders: decay alone makes it ~nothing, the cutoff removes it
entirely. Both are asserted in the pgTAP suite at 15/45/90/181 min.

**③ Weighted voting, not last-write-wins.** LWW makes the newest report the
truth — so one troll, or one honestly-mistaken tap of "packed," overwrites
twenty "short line" reports. Weighted voting instead sums decay weights per
value and takes the max: truth is the *consensus*, weighted by freshness. This
is the spine of the §5.5 poisoning defense — a lone lie is outvoted by any
honest majority, labeled "Low confidence · 1 report," never shown as fact, and
decays toward baseline within ~1 h. The pgTAP suite proves both directions:
one fresh "long" (w≈1.0) does *not* flip a standing "short" consensus (w≈1.22),
but two fresh reports (w≈2.0) *do* — consensus still moves when reality
changes, it just can't be forged cheaply. Same reason the 1–10 sliders
band-vote rather than average: a mean lets one extreme drag the number, a vote
can't.

**④ Fixed-window rate limiting.** We used fixed window — count rows in
`update_rate_limits` for a key over the trailing 10 min / 24 h. Its known
failure mode is the boundary burst: send at 0:09 and again at 0:11 and each
10-minute window sees only one, so a user can briefly straddle ~2× the nominal
rate. We accept it deliberately — for a lunch-line app the worst case is one
extra report, already self-correcting through weighted voting, and fixed-window
is a stateless `count` with nothing to maintain. Token bucket (refill R
tokens/sec, spend one per request) smooths bursts and models rate+burst
cleanly, but needs mutable per-key state — current tokens and last-refill
timestamp, updated atomically — which is more machinery than this earns. Two
independent keys: device (1/spot/10 min, 12/day) and IP (3/spot/10 min,
30/day). Device is the tight one but trivially reset by clearing localStorage;
the IP limit — hashed, never stored raw — is the real backstop, because
rotating phone IPs is expensive.

**⑤ Websockets, not polling.** Realtime pushes only when data actually
changes: one idle persistent connection per client, silent until an INSERT.
Polling means every client asks "anything new?" on a timer regardless. At 200
concurrent users polling every 5 s that's 40 req/s ≈ 3.4 M requests/day, nearly
all answering "nothing changed" — burning Supabase quota and DB CPU to mostly
learn nothing, at up to 5 s staleness. Websockets carry traffic only on real
updates and land sub-2 s. The free-tier ceiling of 200 concurrent connections
is exactly our budget line — a good problem, fixed by a Pro upgrade, not a
rewrite (§8). And the connection is idle-gated (`requestIdleCallback`) so it
never contends with hydration on the critical path — the Phase 3 perf
discipline carries straight in.

**⑥ Optimistic UI, and where it's safe.** Optimistic UI updates the screen as
if the mutation already succeeded, then reconciles if the server disagrees.
It's safe only where the action is low-stakes, effectively idempotent, and a
briefly-wrong state costs nothing. We were deliberately *un*-optimistic on the
update itself: "Sent." shows only after the 201, because a 429 must surface
honestly ("Already reported…") and a false "sent" would corrode the exact trust
the product sells. The genuinely optimistic surfaces are the flag button (mark
"Flagged" instantly, fire the RPC without awaiting) and the follow-up answer
(fire-and-forget) — safe because flagging is idempotent per device via the
`(update_id, device_id)` primary key, so a dropped request is a harmless no-op.
The principle: be optimistic exactly where the server can't meaningfully say
"no" in a way the user needs to see — and honest everywhere else.*
**Phase 5:** Explain stale-while-revalidate like you're teaching a freshman. What are the three Core Web Vitals and which one does the map threaten? Why PWA over native for *this* product — give the distribution argument, not just the effort argument.
*Phase 5 ANSWERED (ritual amended 2026-07-15: Q+A recorded together, no grading loop):*

**① Stale-while-revalidate, for a freshman.** You get home hungry and there's
leftovers in the fridge. You eat them *right now* — no waiting — and while
you're eating you start cooking tomorrow's meal. You never wait for food, but
what you eat is always one meal behind. That's SWR: serve the cached copy
instantly, fire a network request in the background, and swap the cache so the
*next* visit is fresh. You trade freshness for zero latency, and the staleness
is bounded to exactly one request.

The interesting part is where we refused to use it. Serwist's `defaultCache`
applies SWR to the immutable stuff — CSS, JS chunks, fonts, images — where
being one version behind is invisible because the filenames are content-hashed.
But **pages and data are NetworkFirst, not SWR**, and that's a product decision,
not a default we inherited. GritCheck's entire value is a live verdict; SWR on
a spot page would paint a cached "No line" while revalidating, which is
precisely §4.4's ban on presenting stale data as current. For a lunch-line app,
staleness *is* the failure mode — so the cache only ever answers when the
network genuinely fails.

That exposed a subtler bug worth telling: caching a page also freezes the page's
sense of time. Verdicts are pure functions of `now`, and `now` was stamped at
server render — so a service-worker-cached page would replay "8 min ago"
forever, re-breaking the §5.4 guardrail ("a quiet update from 11 AM must never
render as current at 3 PM") through the cache's side door. The fix was
`src/lib/clock.ts`: a minute-tick `useSyncExternalStore` whose server snapshot
keeps hydration byte-identical, so a cached verdict *ages by itself* into "No
recent data · typical: quiet". **Offline honesty needed a clock before it
needed a cache.**

**② The three Core Web Vitals, and which one the map threatens.** LCP (loading
— when the largest text/image block paints, good ≤2.5 s), INP (responsiveness
— Interaction to Next Paint, which replaced FID in March 2024, good ≤200 ms),
CLS (visual stability, good ≤0.1).

The map threatens **INP**, because INP measures main-thread blocking and
MapLibre's parse/eval is ~2.4 s of it on a throttled mid-range phone. Lab
proxy: TBT, which is what we could actually measure. The isolation experiment
made it unambiguous — **60 with the map idle-mounted (TBT 2,780 ms) vs 94–95
with the map mount disabled (TBT 10–30 ms)**. The map was effectively the
entire gap; hydration was innocent, which killed the tempting theory that we
had a React problem. It threatened LCP too, indirectly: in Phase 3 the eval
landed inside the LCP window and starved the main thread so hard that even
server-painted text couldn't repaint (92% "render delay"). CLS was never at
risk — 0 throughout — because the map is absolutely positioned behind a fixed
sheet and the SSR twin reserves the sheet's exact geometry.

The fix: mount the map on the user's first gesture, in an idle slot, with a
10 s fallback so a passive viewer still gets a map. **60 → 94, TBT 2,780 →
~40 ms, LCP 3.1 s, CLS 0.** And the part that actually belongs in an interview:
v1 of that fix mounted on `pointerdown`, which ran MapLibre's eval *inside the
user's first sheet drag* and made it stutter. The score was perfect and the app
felt worse. We moved the eval out of the *gesture* rather than out of the
*load* — waiting for `pointerup`, then idle. A caching strategy can't fix
execution cost: caching skips the fetch, never the parse. That regression was
found by a human dragging a sheet on a phone, not by an auditor, which is
exactly why the §Phase 5 gate wrote the feel-check in as a condition.

**③ Why PWA over native — the distribution argument.** The acquisition channel
*is* the argument. Launch is orientation week (§7.2): QR codes on flyers,
tables, dorm doors, and the moment of intent is a student standing in a hallway
deciding where to eat *right now*. A native app inserts an App Store round trip
between that intent and the answer — search, disambiguate, download over
congested campus wifi, possibly an Apple ID password. Every one of those is a
conversion cliff at the exact moment attention peaks. A URL is about two
seconds to the answer. The install decision then happens *after* the product
proves useful, which is why our prompt waits for the second visit and yields
the session entirely if the follow-up prompt fired: earn the home screen,
don't ask for it.

Three more distribution properties native can't match here:
- **Sharing.** The unit of sharing on a campus is a link in a group chat. A
  link to a spot page opens that spot for everyone. A native deep link opens
  the App Store for anyone who doesn't have the app — every share leaks.
- **Indexing.** "true grit's hours umbc" is a real search. Our spot pages are
  SSR'd with per-spot metadata, OG cards, and a DB-backed sitemap, so Google
  can rank them. A native app is invisible to that channel entirely.
- **Update velocity.** Launch week is when the product is most wrong. We push
  a fix and everyone has it next load; native puts a review queue between the
  bug and the fix during the only week that matters.

The effort argument (one codebase, one solo builder, two platforms) is real but
secondary — it's why it's *possible*, not why it's *right*. Costs we accepted
out loud rather than pretending away: foreground-only geolocation with no
background geofencing (§13.2 accepts this and argues it's a non-creepy
feature), iOS push requiring an actual home-screen install, and iOS giving us
no `beforeinstallprompt` — so the iOS nudge is share-sheet instructions and
ten hand-generated splash screens, because a dark app that launches through a
white flash reads as broken.

**Phase 6:** Why must the scraper be idempotent (what's an upsert)? Why is "fail loudly" a design goal — what's the horror story of a scraper failing silently? Where do secrets live and what never touches the client bundle?
**Phase 7 / meta (rehearse these aloud — they're the interview):** "Walk me through what happens when a user opens the app" (full request lifecycle, cold vs warm cache). "How do you stop one person from poisoning the data?" (§5.5, tell it as a story). "How would this scale to 100 campuses?" (what breaks first: Realtime connections, then tile hosting, then moderation — and what's deliberately single-campus). "What would you build differently with 10 engineers?" (honest answer: almost nothing at this scale — that's the point).

---

## 13. Contribution Incentive System (design locked, build deferred — post-Phase-4)

**Status: forward design capture, not current scope.** Nothing here gets built, scaffolded, or "prepared for" (§0.3) until its trigger. Earliest technical start: after Phase 4 ships the update flow (the thing being incentivized must exist). Default slot: **post-v1.0.0** — §1.4 keeps leaderboards/points out of the v1 launch; pulling this forward requires deliberately amending that contract, not just finishing Phase 4.

### 13.1 Problem statement
GritCheck's value depends on user-submitted updates. An update costs the contributor ~5 seconds and, by default, returns nothing. This system closes that loop. The primary retention driver is and remains the utility itself (§1.1); incentives exist to serve **contribution rate**, not visit frequency. Litmus test for every mechanic below: would it survive contact with a real 19-year-old, or would it get screenshotted into a group chat as cringe (§4.7)? If in doubt, cut.

### 13.2 Location-verified contribution prompts
- When the app is **open** and foreground geolocation places the user at/near a spot, surface a contextual one-tap prompt: *"How's the line at Chick-fil-A?"*
- Multi-vendor locations (The Commons) disambiguate first: *"Which spot are you checking?"* — building-level GPS is the realistic accuracy floor indoors.
- **Location permission is never a gate.** Request it contextually at first benefit — first "Closest" sort or first update attempt — never on page load. A permission dialog before the app has proven useful is how you buy a permanent "Block".
- Location is consumed on-device to pick the prompt; **coordinates are never stored or transmitted** (consistent with the §5.5 no-PII posture).
- **PWA constraint (accepted):** foreground-only geolocation; no background geofencing. The prompt fires when the app is opened at a spot, not because the user walked past one. This is a feature — it keeps the mechanic non-creepy.
- **Prompt budget:** shares the §4.2 follow-up prompt's cap — max 1 contextual prompt per session, never both, never nag. The reciprocity follow-up outranks the location prompt when both are eligible.
- Presence-verification doubles as **data-quality defense**: a "verified nearby" weight bump (or badge) makes remote trolling weaker without adding any friction for honest reporters (§5.5's proportionality principle).

### 13.3 Status mechanics (primary)
The Waze / Google Local Guides model — **status, not stuff**:
- **Contribution streaks** (days with ≥1 update). Streaks lapse gracefully — a missed day shrinks, never zeroes, the number. Streak pressure is how apps become homework.
- **Cumulative campus impact:** "Your updates helped ~N Retrievers this week" — N derived honestly from view counts of spots you updated while your report was the live one. Dry, factual, specific (§4.7); no confetti.
- **Campus leaderboard** (top contributors by handle-less identifier the user names locally, e.g. "quiet-fox-41"): opt-in display, weekly reset so week 1's grinders don't own it forever.

### 13.4 Cosmetic unlocks (secondary)
Points spendable on personalization only: theme/accent variants, map style variants, Grits flair (icon hats, not talking). **Launch the incentive system with 1–2 unlocks max** to prove the loop; expand only on engagement evidence. This is a retention feature, never launch-critical, and never purchasable — points come from contributions or nowhere.

### 13.5 Identity approach
- **Points ledger lives device-local** (localStorage/IndexedDB) — preserves the locked no-auth constraint (§1.4). Note: the server already knows anonymous `device_id`s for rate limiting (§3.1/§5.5); what stays local is the *accounting*, so no new server-side identity surface is created.
- **Accepted tradeoffs, documented:** ledger clears with browser data; no cross-device sync. Accepted risk: cosmetics aren't worth farming — anyone dedicated enough to farm a Grits hat is generating useful data anyway (rate limits still apply).
- **Escalation paths, only if evidence demands:** server-side points accounting keyed to the existing anonymous device_id → optional opt-in identity. In that order, each gated on observed need, never speculatively.

### 13.6 Rejected: freetext location messages
Anonymous, unmoderated, location-tagged freetext on a campus is the **Yik Yak failure mode**: harassment with no accountability (no accounts = no bans that stick), targeting of specific people/places, and an unbounded moderation burden a solo builder cannot carry. **Rejected before build, permanently.** If social texture is ever wanted, it is *structured input only* — preset reactions, votes, the existing 80-char moderated comments (§5.5) — never open freetext. This rejection is load-bearing; do not relitigate it in a future session without Alan explicitly reopening it here.

### 13.7 Sequencing & real-world rewards
Design locked now (this section). Build after the update-posting flow exists and v1 has shipped (see header). **Real-world rewards (dining discounts, SGA partnerships) are explicitly post-traction:** WAU numbers earn that meeting; the meeting doesn't earn the WAU. Nothing in this section creates schema, code, or UI obligations for Phases 2–7.

---
*Written July 2026 with Claude (Fable 5). Amend deliberately; drift never.*
