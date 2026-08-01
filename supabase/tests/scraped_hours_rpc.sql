-- replace_scraped_hours() — BUILD_PLAN §Phase 6, migration 20260731000100.
--
-- This is the scraper's only write path. What it must guarantee:
--   * idempotent — the same payload twice converges, never duplicates (§12)
--   * atomic     — a failed run leaves the table exactly as it found it
--   * scoped     — spots absent from the payload are untouched
--   * safe       — 'manual' overrides survive any run
--   * LOUD       — an unknown slug or an empty run raises; it never no-ops green
--
-- Run: npx supabase test db   (local stack must be up: npx supabase start)
-- Everything here rolls back — no residue in the local database.

begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into spots (id, slug, name, category, building, lat, lng) values
  ('00000000-0000-4000-a000-000000000001', 'rpc-a', 'RPC A', 'food',  'T', 39.25, -76.71),
  ('00000000-0000-4000-a000-000000000002', 'rpc-b', 'RPC B', 'food',  'T', 39.25, -76.71),
  ('00000000-0000-4000-a000-000000000003', 'rpc-c', 'RPC C', 'study', 'T', 39.25, -76.71);

-- All three begin as prod did: provisional-only, no scrape has ever run.
insert into spot_hours (spot_id, day_of_week, opens, closes, source)
select id, d, '00:00', '23:59', 'manual-provisional'
from spots cross join generate_series(0, 6) d
where slug like 'rpc-%';

-- ── 1. A first run writes rows and records coverage ─────────────────────────
select is(
  (select replace_scraped_hours($$
     {"spots": [
       {"slug": "rpc-a", "hours": [{"day_of_week": 1, "opens": "09:00", "closes": "17:00"},
                                   {"day_of_week": 2, "opens": "09:00", "closes": "17:00"}]},
       {"slug": "rpc-b", "hours": []}
     ]}$$::jsonb)),
  '{"rows_deleted": 0, "rows_inserted": 2, "spots_covered": 2}'::jsonb,
  'a first run reports what it did: 2 spots covered, 2 rows in, 0 out'
);

select is(
  (select count(*)::int from spot_hours h join spots s on s.id = h.spot_id
     where s.slug = 'rpc-a' and h.source = 'scraped'),
  2,
  'the scraped rows landed'
);

select isnt(
  (select hours_scraped_at from spots where slug = 'rpc-a'),
  null,
  'coverage is recorded for a spot that produced rows'
);

-- The whole reason coverage is explicit rather than inferred from row counts.
select isnt(
  (select hours_scraped_at from spots where slug = 'rpc-b'),
  null,
  'coverage is recorded for a CLOSED-all-week spot too, which produced none'
);

select is(
  (select count(*)::int from spot_effective_hours h join spots s on s.id = h.spot_id
     where s.slug = 'rpc-b'),
  0,
  'that closed spot now reads closed, instead of falling back to provisional'
);

-- ── 2. Spots outside the payload are untouched ──────────────────────────────
-- A run where only one feed succeeded must not blank the other feed's spots.
select is(
  (select hours_scraped_at from spots where slug = 'rpc-c'),
  null,
  'a spot absent from the payload is not marked as covered'
);

select is(
  (select count(*)::int from spot_effective_hours h join spots s on s.id = h.spot_id
     where s.slug = 'rpc-c'),
  7,
  'and it keeps serving its provisional hours'
);

-- ── 3. Idempotency ──────────────────────────────────────────────────────────
select is(
  (select replace_scraped_hours($$
     {"spots": [
       {"slug": "rpc-a", "hours": [{"day_of_week": 1, "opens": "09:00", "closes": "17:00"},
                                   {"day_of_week": 2, "opens": "09:00", "closes": "17:00"}]},
       {"slug": "rpc-b", "hours": []}
     ]}$$::jsonb)),
  '{"rows_deleted": 2, "rows_inserted": 2, "spots_covered": 2}'::jsonb,
  'the SAME payload again deletes 2 and re-inserts 2 — converges, not appends'
);

select is(
  (select count(*)::int from spot_hours h join spots s on s.id = h.spot_id
     where s.slug = 'rpc-a' and h.source = 'scraped'),
  2,
  'idempotent: still exactly 2 scraped rows after the second identical run'
);

-- ── 4. A later run NARROWS, which is the point of the whole design ──────────
select is(
  (select (replace_scraped_hours($$
     {"spots": [{"slug": "rpc-a", "hours": [{"day_of_week": 1, "opens": "09:00", "closes": "11:00"}]}]}
   $$::jsonb) ->> 'rows_inserted')::int),
  1,
  'UMBC cuts the hours; the run writes the smaller set'
);

select is(
  (select exists (
     select 1 from spot_effective_hours h join spots s on s.id = h.spot_id
     where s.slug = 'rpc-a' and h.day_of_week = 2)),
  false,
  'the dropped day is GONE from the read path — hours can shrink, not only grow'
);

-- ── 5. Manual overrides survive a run ───────────────────────────────────────
insert into spot_hours (spot_id, day_of_week, opens, closes, source)
values ('00000000-0000-4000-a000-000000000001', 5, '12:00', '13:00', 'manual');

select lives_ok(
  $$select replace_scraped_hours('{"spots": [{"slug": "rpc-a", "hours": []}]}'::jsonb)$$,
  'a run against a spot with a manual override succeeds'
);

select is(
  (select array_agg(distinct h.source) from spot_effective_hours h
     join spots s on s.id = h.spot_id where s.slug = 'rpc-a'),
  array['manual'],
  'and the override is still standing, still winning'
);

-- ── 6. Loud failures ────────────────────────────────────────────────────────
-- Both of these would be a green no-op if they were tolerated, which is exactly
-- the failure mode the phase's exit criterion names.
select throws_ok(
  $$select replace_scraped_hours('{"spots": []}'::jsonb)$$,
  'payload.spots is empty — a run covering no spot is a bug, not a no-op',
  'an empty run raises instead of reporting success'
);

select throws_ok(
  $$select replace_scraped_hours('{"spots": [{"slug": "rpc-renamed", "hours": []}]}'::jsonb)$$,
  'unknown spot slug(s): rpc-renamed',
  'a renamed spot reddens the run instead of being silently skipped'
);

-- ── 7. Who may call it at all ───────────────────────────────────────────────
-- These assert the ACL directly rather than probing with a request, because a
-- probe only tells you about the instance you probed. 20260731000100 shipped
-- with anon still holding EXECUTE in production while this suite passed
-- locally: Supabase's default ACL grants EXECUTE to anon BY NAME, and revoking
-- from PUBLIC does not remove a named grant. The function is SECURITY DEFINER
-- and reachable over PostgREST, so anon EXECUTE means anyone holding the
-- client-bundle key can rewrite campus hours. Fixed in 20260731000200.
select function_privs_are(
  'public', 'replace_scraped_hours', array['jsonb'],
  'anon', array[]::text[],
  'anon holds NO privilege on replace_scraped_hours'
);

select function_privs_are(
  'public', 'replace_scraped_hours', array['jsonb'],
  'authenticated', array[]::text[],
  'authenticated holds NO privilege on replace_scraped_hours'
);

select function_privs_are(
  'public', 'replace_scraped_hours', array['jsonb'],
  'service_role', array['EXECUTE'],
  'service_role — the scraper''s GitHub Actions identity — may execute it'
);

select * from finish();
rollback;
