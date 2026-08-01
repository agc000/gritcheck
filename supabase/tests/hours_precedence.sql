-- Hours source precedence — BUILD_PLAN §Phase 6, migration 20260730000100.
--
-- The headline assertion (test 3): a scraped row must be able to NARROW a
-- spot's open window, not merely widen it. Before precedence, is_open unioned
-- every row in spot_hours regardless of source, so the Phase-3 provisional seed
-- would have kept a spot "open" at hours the scraper had just removed — a
-- scraper running green twice a day while changing nothing a student sees.
--
-- Run: npx supabase test db   (local stack must be up: npx supabase start)
-- Everything here rolls back — no residue in the local database.

begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Slugs namespaced so they cannot collide with seeded spots.
insert into spots (id, slug, name, category, building, lat, lng) values
  ('00000000-0000-4000-9000-000000000001', 'prec-scraped',  'Prec Scraped',  'food',  'T', 39.25, -76.71),
  ('00000000-0000-4000-9000-000000000002', 'prec-override', 'Prec Override', 'food',  'T', 39.25, -76.71),
  ('00000000-0000-4000-9000-000000000003', 'prec-untouched','Prec Untouched','study', 'T', 39.25, -76.71);

-- All three start life the way prod did: provisional-only, open all week.
insert into spot_hours (spot_id, day_of_week, opens, closes, source)
select id, d, '00:00', '23:59', 'manual-provisional'
from spots cross join generate_series(0, 6) d
where slug like 'prec-%';

-- ── 1. Provisional is visible while nothing outranks it ─────────────────────
select is(
  (select count(*)::int from spot_effective_hours h
     join spots s on s.id = h.spot_id where s.slug = 'prec-untouched'),
  7,
  'provisional rows are effective when a spot has no scraped or manual rows'
);

select is(
  (select bool_and(h.source = 'manual-provisional') from spot_effective_hours h
     join spots s on s.id = h.spot_id where s.slug = 'prec-untouched'),
  true,
  'a spot with only provisional rows reports source manual-provisional'
);

-- ── 2. Scraped outranks provisional, whole-tier ─────────────────────────────
-- One scraped row replaces all seven provisional ones. Tiers never mix.
insert into spot_hours (spot_id, day_of_week, opens, closes, source)
values ('00000000-0000-4000-9000-000000000001', 1, '09:00', '11:00', 'scraped');

select is(
  (select count(*)::int from spot_effective_hours h
     join spots s on s.id = h.spot_id where s.slug = 'prec-scraped'),
  1,
  'one scraped row shadows all seven provisional rows — tiers never mix'
);

select is(
  (select count(*)::int from spot_hours h
     join spots s on s.id = h.spot_id where s.slug = 'prec-scraped'),
  8,
  'the provisional rows still EXIST — shadowed, not deleted (rollback stays cheap)'
);

-- ── 3. THE headline: scraped hours can NARROW, not just widen ───────────────
-- Monday noon is inside the provisional 00:00–23:59 and outside the scraped
-- 09:00–11:00. The old union answered "open"; precedence must answer "closed".
select is(
  (select exists (
     select 1 from spot_effective_hours h
     where h.spot_id = '00000000-0000-4000-9000-000000000001'
       and h.day_of_week = 1
       and time '12:00' >= h.opens and time '12:00' < h.closes)),
  false,
  'NARROWING: a slot the scraper dropped reads CLOSED (the silent-no-op bug)'
);

select is(
  (select exists (
     select 1 from spot_effective_hours h
     where h.spot_id = '00000000-0000-4000-9000-000000000001'
       and h.day_of_week = 1
       and time '10:00' >= h.opens and time '10:00' < h.closes)),
  true,
  'the slot the scraper DID publish reads open'
);

-- Same instant, straight off spot_hours: proves the union bug is real and that
-- this test would fail against the pre-precedence read path.
select is(
  (select exists (
     select 1 from spot_hours h
     where h.spot_id = '00000000-0000-4000-9000-000000000001'
       and h.day_of_week = 1
       and time '12:00' >= h.opens and time '12:00' < h.closes)),
  true,
  'control: unioning raw spot_hours still answers "open" — what we fixed'
);

-- ── 4. A partial scrape does not blank the rest of campus ───────────────────
select is(
  (select count(*)::int from spot_effective_hours h
     join spots s on s.id = h.spot_id where s.slug = 'prec-untouched'),
  7,
  'scraping one spot leaves every other spot on its own tier'
);

-- ── 5. manual is the override of last resort ────────────────────────────────
insert into spot_hours (spot_id, day_of_week, opens, closes, source)
values
  ('00000000-0000-4000-9000-000000000002', 2, '08:00', '09:00', 'scraped'),
  ('00000000-0000-4000-9000-000000000002', 3, '13:00', '14:00', 'manual');

select is(
  (select array_agg(distinct h.source) from spot_effective_hours h
     join spots s on s.id = h.spot_id where s.slug = 'prec-override'),
  array['manual'],
  'manual outranks BOTH scraped and provisional — Alan always wins'
);

-- ── 6. The tier set is closed ───────────────────────────────────────────────
-- An unranked source would sort NULL and drop the spot out of the view
-- entirely; the check constraint makes that unrepresentable.
select throws_ok(
  $$insert into spot_hours (spot_id, day_of_week, opens, closes, source)
    values ('00000000-0000-4000-9000-000000000003', 4, '08:00', '09:00', 'scrapd')$$,
  '23514',
  null,
  'a typo''d source is rejected, never silently ranked NULL'
);

-- ── 7. The coverage gate: scraped-and-closed is CLOSED, not a fallback ──────
-- 20260731000100. 'prec-untouched' still has its seven provisional rows and no
-- scraped rows at all. Marking it as covered by a scrape must hide them: the
-- scraper looked, found the venue shut all week, and that is the true answer.
-- Without this gate the spot would quietly display last season's guess — the
-- normal case off-season, where 12 of 22 dining venues are closed all week.
update spots
set hours_scraped_at = now()
where slug = 'prec-untouched';

select is(
  (select count(*)::int from spot_effective_hours h
     join spots s on s.id = h.spot_id where s.slug = 'prec-untouched'),
  0,
  'GATE: a scraped spot with zero scraped rows shows NO hours, not provisional'
);

select is(
  (select count(*)::int from spot_hours h
     join spots s on s.id = h.spot_id where s.slug = 'prec-untouched'),
  7,
  'the provisional rows still exist underneath — suppressed, not deleted'
);

-- ── 8. The gate never overrides a human ─────────────────────────────────────
update spots
set hours_scraped_at = now()
where slug = 'prec-override';

select is(
  (select array_agg(distinct h.source) from spot_effective_hours h
     join spots s on s.id = h.spot_id where s.slug = 'prec-override'),
  array['manual'],
  'a covered spot still yields to manual — the scraper cannot outrank Alan'
);

select * from finish();
rollback;
