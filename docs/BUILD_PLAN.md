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
User accounts/auth · reviews or star ratings · chat rooms · gym category · push notifications · native app · menus · favorites · photos · leaderboards/points · admin dashboard beyond Supabase Studio · email (no Resend) · historical "popular times" charts (needs weeks of real data — post-launch).

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
--black:#121110  --map-bg:#191813  --ink:#1D1B16   --sheet:#FFFFFF
--gold:#FFC20E   --gold-soft:rgba(255,194,14,.09)
--line:#EEEDE8   --soft:#F7F6F3   --muted:#77746C  --faint:#ACA9A0
--go:#178A50     --hold:#B37400   --skip:#C2402F   --closed:#9A978D
Type: Archivo (400/500/600/700/800) for UI; Spline Sans Mono for timestamps/data only.
Radii: 20px sheet, 12–14px cards/controls, 999px pills. Spacing on a 4px grid.
```
Gold is a **signal**, not decoration: Update button, active filter state, Best bet wash, selected building. If gold appears anywhere else, it's wrong. Green/amber/red/gray appear **only** as status colors.

### 4.2 Screen architecture (locked, from v7)
- **Home = full-screen MapLibre map** (custom dark-gold style, locked to campus bounds, pitch/rotation disabled) with buildings as tap targets; status glow halos on active buildings.
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
**Exit:** map feels premium (the "cool" bar Alan set); tap-through works; Lighthouse perf ≥85 with map mounted.

### Phase 4 — Live layer: updates, decay, Realtime
Tasks: Edge Function `submit-update` with §5.5 limits + tests; Update sheet flow (§4.2) with geolocation pre-select; decay view live → rows show real verdicts + confidence; Realtime subscription updating open clients; follow-up prompt mechanic; comment display + flag/auto-hide; `events` instrumentation for the §8.4 metrics.
**Exit:** two devices side by side — an update on one changes the other within 2 s; rate limits demonstrably enforced; the 11 AM-report-at-3 PM guardrail test passes.

### Phase 5 — PWA + performance + SEO
Tasks: Serwist service worker (cache shell + last-known data; offline shows cached statuses with honest staleness labels); manifest + icons (Grits mark) + splash; install prompt UX ("Add GritCheck to your home screen" moment after second visit); SSR/ISR spot pages with metadata ("True Grit's hours & live line — GritCheck"); OG images; sitemap; performance pass to hit the 5-second loop on 4G (target: interactive < 2.5 s repeat visit).
**Exit:** Lighthouse PWA installable + perf ≥90; add-to-home-screen works on iOS Safari; Google can index spot pages.

### Phase 6 — Scraper in production + hardening
Tasks: finalize scraper from Phase 0 spike; GH Actions cron (2×/day, plus manual dispatch); upsert with `source='scraped'`, keep `manual` overrides winning; failure alerting (Action failure → GitHub notification is enough); scraper unit tests on fixtures; error boundary + minimal logging in app; legal footer ("unofficial, built by a UMBC student"), simple privacy note (anonymous device ID, no accounts, no PII).
**Exit:** hours update end-to-end from UMBC's site with no human touch; a deliberately broken fixture fails loudly, not silently.

### Phase 7 — Polish sprint + private beta
Tasks: full §4.8 audit of every screen; copy pass (§4.7); micro-interactions; 404/offline/empty states with Grits; seed **fresh real data week** (Alan updates statuses himself daily so the beta never looks dead); recruit 10–20 friends as beta users; fix the top 5 friction points they hit; tag `v1.0.0`.
**Alan provides:** beta testers; a week of self-seeded updates; final consensus-line pass.
**Exit:** a stranger handed the URL can install it, get a useful answer, and submit an update without explanation.

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
Historical "popular times" charts (≥3 wks of data) · Gym/RAC category (≥500 WAU or loud demand) · Web push "tell me when RAC empties" (≥1,000 installs) · LLM-derived consensus lines from comments (≥50 comments/spot — strong resume feature) · spot activity streams → chat (≥500 WAU **and** moderation plan) · Cloudflare Turnstile on updates (only if scripted abuse observed, §5.5) · native/Expo app (only if PWA install friction is provably the bottleneck) · other campuses (never before UMBC is won).

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
**Phase 4 (the big one):** Walk through the full lifecycle of one update: tap → Edge Function → rate limit checks → insert → aggregation view → Realtime push → another student's screen. Why exponential decay instead of a hard time window? Why weighted voting instead of last-write-wins? Fixed-window vs token-bucket rate limiting — which did we use and what's the failure mode? Why websockets instead of polling, and what would polling cost at 200 concurrent users? What's optimistic UI and where is it safe?
**Phase 5:** Explain stale-while-revalidate like you're teaching a freshman. What are the three Core Web Vitals and which one does the map threaten? Why PWA over native for *this* product — give the distribution argument, not just the effort argument.
**Phase 6:** Why must the scraper be idempotent (what's an upsert)? Why is "fail loudly" a design goal — what's the horror story of a scraper failing silently? Where do secrets live and what never touches the client bundle?
**Phase 7 / meta (rehearse these aloud — they're the interview):** "Walk me through what happens when a user opens the app" (full request lifecycle, cold vs warm cache). "How do you stop one person from poisoning the data?" (§5.5, tell it as a story). "How would this scale to 100 campuses?" (what breaks first: Realtime connections, then tile hosting, then moderation — and what's deliberately single-campus). "What would you build differently with 10 engineers?" (honest answer: almost nothing at this scale — that's the point).

---
*Written July 2026 with Claude (Fable 5). Amend deliberately; drift never.*
