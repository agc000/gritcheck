-- Decay guardrail tests — BUILD_PLAN §5.4.
-- The headline assertion: a "quiet" report from 11 AM must NEVER render as
-- current at 3 PM. Plus the τ curve at 15/45/90/180 min, confidence buckets,
-- the weighted vote, and the §5.5 escalation switches (frozen, hidden).
--
-- Run: npx supabase test db   (local stack must be up: npx supabase start)
-- Everything here rolls back — no residue in the local database.

begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Fixed UUIDs; slugs namespaced so they can't collide with seeded spots.
-- Hours 00:00–23:59 every day so is_open never depends on when the test runs.
insert into spots (id, slug, name, category, building, lat, lng) values
  ('00000000-0000-4000-8000-000000000001', 'test-food',   'Test Food',   'food',  'T', 39.25, -76.71),
  ('00000000-0000-4000-8000-000000000002', 'test-study',  'Test Study',  'study', 'T', 39.25, -76.71),
  ('00000000-0000-4000-8000-000000000003', 'test-frozen', 'Test Frozen', 'food',  'T', 39.25, -76.71);
update spots set frozen = true where slug = 'test-frozen';
insert into spot_hours (spot_id, day_of_week, opens, closes, source)
select id, d, '00:00', '23:59', 'manual'
from spots cross join generate_series(0, 6) d
where slug like 'test-%';

-- ── 1. THE guardrail: 4-hour-old report is not current ──────────────────────
insert into updates (spot_id, device_id, kind, noise, created_at) values
  ('00000000-0000-4000-8000-000000000002', gen_random_uuid(), 'study', 'quiet',
   now() - interval '4 hours');

select is(
  (select noise from spot_current_status where slug = 'test-study'),
  null,
  'guardrail: a quiet report from 4h ago yields NO current noise verdict'
);
select is(
  (select confidence from spot_current_status where slug = 'test-study'),
  'low',
  'guardrail: 4h-old report leaves confidence low (baseline framing)'
);
select ok(
  (select confidence_weight from spot_current_status where slug = 'test-study') = 0,
  'guardrail: 4h-old report contributes zero weight'
);
select ok(
  (select last_update_at from spot_current_status where slug = 'test-study')
    is not null,
  'guardrail: last_update_at survives the cutoff so UI can say "no reports since 11 AM"'
);

-- ── 2. Window boundary: 2h59m in, 3h01m out ────────────────────────────────
insert into updates (spot_id, device_id, kind, crowd, created_at) values
  ('00000000-0000-4000-8000-000000000002', gen_random_uuid(), 'study', 'packed',
   now() - interval '2 hours 59 minutes');
select is(
  (select crowd from spot_current_status where slug = 'test-study'),
  'packed',
  'boundary: a 2h59m-old report is still inside the 3h window'
);

-- ── 3. τ curve, food (τ = 45): w = exp(-Δt/45) at 15/45/90/180 min ─────────
-- Weights checked to a 0.005 tolerance: created_at is fixed at insert but
-- now() advances microseconds by the time the view evaluates.
-- 15 min → exp(-1/3) ≈ 0.7165
insert into updates (spot_id, device_id, kind, line, created_at) values
  ('00000000-0000-4000-8000-000000000001', gen_random_uuid(), 'food', 'short',
   now() - interval '15 minutes');
select ok(
  abs((select confidence_weight from spot_current_status where slug = 'test-food')
      - exp(-15.0 / 45.0)) < 0.005,
  'tau food: 15-min-old update weighs exp(-1/3) ~ 0.72'
);

-- 45 min → cumulative w = exp(-1/3) + exp(-1) ≈ 0.7165 + 0.3679
insert into updates (spot_id, device_id, kind, line, created_at) values
  ('00000000-0000-4000-8000-000000000001', gen_random_uuid(), 'food', 'short',
   now() - interval '45 minutes');
select ok(
  abs((select confidence_weight from spot_current_status where slug = 'test-food')
      - (exp(-15.0 / 45.0) + exp(-1.0))) < 0.005,
  'tau food: adding a 45-min-old update adds exp(-1) ~ 0.37'
);

-- 90 min → adds exp(-2) ≈ 0.1353
insert into updates (spot_id, device_id, kind, line, created_at) values
  ('00000000-0000-4000-8000-000000000001', gen_random_uuid(), 'food', 'short',
   now() - interval '90 minutes');
select ok(
  abs((select confidence_weight from spot_current_status where slug = 'test-food')
      - (exp(-15.0 / 45.0) + exp(-1.0) + exp(-2.0))) < 0.005,
  'tau food: adding a 90-min-old update adds exp(-2) ~ 0.14'
);

-- §5.1: updates OLDER than 3h are ignored entirely. now() is frozen for the
-- whole transaction, so exactly-180-min would sit ON the >= cutoff and count
-- (weight exp(-4)); 181 min is strictly older and must add nothing.
insert into updates (spot_id, device_id, kind, line, created_at) values
  ('00000000-0000-4000-8000-000000000001', gen_random_uuid(), 'food', 'short',
   now() - interval '181 minutes');
select ok(
  abs((select confidence_weight from spot_current_status where slug = 'test-food')
      - (exp(-15.0 / 45.0) + exp(-1.0) + exp(-2.0))) < 0.005,
  'tau food: a 181-min-old update adds nothing (outside the window)'
);

-- ── 4. τ study (τ = 90): 90-min-old update weighs exp(-1) ──────────────────
-- test-study currently holds the 2h59m 'packed' row: w = exp(-179/90).
insert into updates (spot_id, device_id, kind, crowd, created_at) values
  ('00000000-0000-4000-8000-000000000002', gen_random_uuid(), 'study', 'packed',
   now() - interval '90 minutes');
select ok(
  abs((select confidence_weight from spot_current_status where slug = 'test-study')
      - (exp(-179.0 / 90.0) + exp(-1.0))) < 0.005,
  'tau study: 90-min-old update weighs exp(-1) under tau=90'
);

-- ── 5. Weighted vote: fresher outvotes older (§5.2, §5.5 poisoning model) ──
-- Standing food votes are three 'short' (w ~ 0.72 + 0.37 + 0.14 = 1.22).
-- One fresh 'long' (w ~ 1.0) does NOT flip the verdict...
insert into updates (spot_id, device_id, kind, line, created_at) values
  ('00000000-0000-4000-8000-000000000001', gen_random_uuid(), 'food', 'long',
   now() - interval '1 minute');
select is(
  (select line from spot_current_status where slug = 'test-food'),
  'short',
  'vote: one fresh lie (w~1.0) is outvoted by accumulated honest weight (~1.22)'
);
-- ...but a second fresh 'long' does (2.0 > 1.22) — consensus can still move.
insert into updates (spot_id, device_id, kind, line, created_at) values
  ('00000000-0000-4000-8000-000000000001', gen_random_uuid(), 'food', 'long',
   now() - interval '1 minute');
select is(
  (select line from spot_current_status where slug = 'test-food'),
  'long',
  'vote: two fresh reports outweigh the decayed old consensus'
);

-- ── 6. Confidence buckets (§5.3): W>=2.0 high, 0.8<=W<2.0 medium ───────────
select is(
  (select confidence from spot_current_status where slug = 'test-food'),
  'high',
  'confidence: W ~ 3.2 on test-food buckets as high'
);
-- test-study is at W ~ exp(-179/90) + exp(-1) ~ 0.50 (low); one more report
-- at 30 min (w = exp(-1/3) ~ 0.72) lifts it into the medium band.
insert into updates (spot_id, device_id, kind, crowd, created_at) values
  ('00000000-0000-4000-8000-000000000002', gen_random_uuid(), 'study', 'packed',
   now() - interval '30 minutes');
select is(
  (select confidence from spot_current_status where slug = 'test-study'),
  'medium',
  'confidence: W ~ 1.2 on test-study buckets as medium'
);

-- ── 7. frozen kill switch (§5.5): live data ignored, baseline-only ─────────
insert into updates (spot_id, device_id, kind, line, created_at) values
  ('00000000-0000-4000-8000-000000000003', gen_random_uuid(), 'food', 'long',
   now() - interval '1 minute');
select is(
  (select line from spot_current_status where slug = 'test-frozen'),
  null,
  'frozen: a fresh update on a frozen spot yields no live verdict'
);
select is(
  (select confidence from spot_current_status where slug = 'test-frozen'),
  'low',
  'frozen: confidence pinned low so UI falls back to baseline framing'
);

-- ── 8. hidden updates are invisible to aggregation ─────────────────────────
insert into updates (spot_id, device_id, kind, crowd, hidden, created_at) values
  ('00000000-0000-4000-8000-000000000002', gen_random_uuid(), 'study', 'empty', true,
   now() - interval '1 minute');
select is(
  (select crowd from spot_current_status where slug = 'test-study'),
  'packed',
  'hidden: a hidden fresh report does not move the verdict'
);

select * from finish();
rollback;
