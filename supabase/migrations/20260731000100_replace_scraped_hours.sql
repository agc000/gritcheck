-- Atomic scraper write path (Phase 6, task 2), plus the correction it forced.
--
-- WHY AN RPC AND NOT POSTGREST. The scraper replaces a spot's hours, which is
-- delete-then-insert. Over PostgREST that is two HTTP calls = two transactions.
-- A process killed between them (GH Actions timeout, runner eviction, a 500 on
-- the second call) leaves the spot with ZERO scraped rows — and the read path
-- then quietly serves stale provisional hours with nothing anywhere reporting a
-- problem. One RPC is one transaction: the whole run lands or none of it does.
--
-- THE CORRECTION TO 20260730000100. That migration ranked a spot's tier by
-- which rows existed, so "scraped, closed all week" (zero rows) was
-- indistinguishable from "never scraped" (zero rows) — and a venue genuinely
-- shut for the summer would fall back to displaying last season's provisional
-- guess. In the Phase 0 fixtures that is 12 of 22 dining venues, so it is the
-- normal case off-season, not an edge case. Precedence must key off whether the
-- spot was SCRAPED, not whether scraping produced rows. Hence
-- spots.hours_scraped_at, and a view that suppresses provisional rows for any
-- spot the scraper has successfully covered — even with nothing to show for it.
-- A closed venue now reads CLOSED, which is the true answer.

-- null = never successfully scraped. Set only by replace_scraped_hours() below,
-- so it means "a scrape run covered this spot and committed", never "we tried".
alter table spots add column if not exists hours_scraped_at timestamptz;

comment on column spots.hours_scraped_at is
  'Last successful scrape covering this spot. NULL suppresses nothing; non-NULL '
  'makes manual-provisional hours invisible for this spot even when the scrape '
  'found zero open hours (a closed venue is closed, not "fall back to the seed").';

-- Same three tiers as 20260730000100 — manual > scraped > manual-provisional —
-- with provisional now gated on the spot never having been scraped.
create or replace view spot_effective_hours
with (security_invoker = true) as
with ranked as (
  select
    h.id,
    h.spot_id,
    h.day_of_week,
    h.opens,
    h.closes,
    h.source,
    h.scraped_at,
    case h.source
      when 'manual'             then 1
      when 'scraped'            then 2
      when 'manual-provisional' then 3
    end as tier
  from spot_hours h
),
-- The gate: once a spot has been scraped, its provisional rows stop existing as
-- far as every reader is concerned. `manual` is unaffected — it outranks both
-- and is the one tier a scrape run never touches.
eligible as (
  select r.*
  from ranked r
  join spots s on s.id = r.spot_id
  where r.tier <> 3 or s.hours_scraped_at is null
),
winner as (
  select spot_id, min(tier) as tier
  from eligible
  group by spot_id
)
select e.id, e.spot_id, e.day_of_week, e.opens, e.closes, e.source, e.scraped_at
from eligible e
join winner w on w.spot_id = e.spot_id and w.tier = e.tier;

-- ── The write path ──────────────────────────────────────────────────────────
-- Payload shape — one entry per spot the run COVERED, hours possibly empty:
--   { "spots": [ { "slug": "true-grits",
--                  "hours": [ {"day_of_week":1,"opens":"09:00","closes":"11:00"} ] },
--                { "slug": "chick-fil-a", "hours": [] } ] }
--
-- Coverage is explicit rather than inferred from the rows, because that is the
-- whole point of the correction above: "I scraped Chick-fil-A and it is shut"
-- has to be expressible, and has to be different from "Chick-fil-A never came
-- up". A spot absent from the payload is left completely alone, so a run where
-- only the library feed succeeded cannot blank the dining venues.
--
-- Idempotent: delete-then-insert for exactly the covered spots means running the
-- same payload twice converges instead of duplicating (§12 Phase 6 — "why must
-- the scraper be idempotent").
--
-- WHAT THIS DELIBERATELY DOES NOT CHECK: whether the run looks plausible in
-- aggregate (too few venues, every venue closed, hours that moved wildly). That
-- judgment needs to know which FEED each spot came from and what the previous
-- run looked like, so it lives in the scraper's invariant layer (task 4) where
-- it can fail the Action before ever calling this. The guards here are only for
-- things that are unambiguously bugs at the data layer.
create or replace function replace_scraped_hours(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_spots    jsonb := payload -> 'spots';
  v_slugs    text[];
  v_unknown  text[];
  v_bad      text[];
  v_spot_ids uuid[];
  v_deleted  int;
  v_inserted int;
begin
  if v_spots is null or jsonb_typeof(v_spots) <> 'array' then
    raise exception 'payload.spots must be an array of {slug, hours}';
  end if;

  -- A run that covers nothing is a broken run, not a legitimate empty state.
  -- Returning success here would be the exact silent no-op the phase exists to
  -- prevent, so it is an error at the innermost layer too.
  if jsonb_array_length(v_spots) = 0 then
    raise exception 'payload.spots is empty — a run covering no spot is a bug, not a no-op';
  end if;

  select array_agg(distinct e ->> 'slug')
  into v_slugs
  from jsonb_array_elements(v_spots) e;

  if v_slugs is null or array_position(v_slugs, null) is not null then
    raise exception 'every payload.spots entry needs a slug';
  end if;

  -- A renamed or retired spot must redden the run, never silently skip: a
  -- scraper that writes 21 of 22 spots and reports success is how hours rot.
  select array_agg(x)
  into v_unknown
  from unnest(v_slugs) x
  where not exists (select 1 from spots where slug = x);

  if v_unknown is not null then
    raise exception 'unknown spot slug(s): %', array_to_string(v_unknown, ', ');
  end if;

  select array_agg(e ->> 'slug')
  into v_bad
  from jsonb_array_elements(v_spots) e
  where e -> 'hours' is not null and jsonb_typeof(e -> 'hours') <> 'array';

  if v_bad is not null then
    raise exception 'payload.spots[].hours must be an array; bad for: %',
      array_to_string(v_bad, ', ');
  end if;

  select array_agg(id) into v_spot_ids from spots where slug = any(v_slugs);

  -- Only 'scraped' rows are touched. 'manual' and 'manual-provisional' survive
  -- by construction — the scraper cannot destroy an override even by accident.
  delete from spot_hours
  where spot_id = any(v_spot_ids) and source = 'scraped';
  get diagnostics v_deleted = row_count;

  insert into spot_hours (spot_id, day_of_week, opens, closes, source, scraped_at)
  select
    s.id,
    (h ->> 'day_of_week')::int,
    (h ->> 'opens')::time,
    (h ->> 'closes')::time,
    'scraped',
    now()
  from jsonb_array_elements(v_spots) e
  join spots s on s.slug = e ->> 'slug'
  cross join lateral jsonb_array_elements(coalesce(e -> 'hours', '[]'::jsonb)) h;
  get diagnostics v_inserted = row_count;

  -- Marks coverage. Set AFTER the writes so it can only be true of a
  -- transaction that actually committed its rows.
  update spots set hours_scraped_at = now() where id = any(v_spot_ids);

  return jsonb_build_object(
    'spots_covered', coalesce(array_length(v_spot_ids, 1), 0),
    'rows_deleted',  v_deleted,
    'rows_inserted', v_inserted
  );
end;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default. On a SECURITY
-- DEFINER function reachable over PostgREST that would let any anonymous
-- visitor rewrite campus hours, so the revoke is load-bearing, not hygiene.
revoke all on function replace_scraped_hours(jsonb) from public;
grant execute on function replace_scraped_hours(jsonb) to service_role;
