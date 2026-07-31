-- Hours source precedence (Phase 6, task 1).
--
-- THE PROBLEM THIS FIXES. §Phase 6 says "upsert with source='scraped', keep
-- manual overrides winning", but the read path had no notion of source at all:
-- is_open was `exists (select 1 from spot_hours where spot_id = s.id and ...)`.
-- With the 130 Phase-3 seed rows still in the table, scraped rows could only
-- ever WIDEN a spot's open window, never narrow it — UMBC cutting True Grit's
-- hours would change nothing on screen, on every green scraper run, forever.
-- That is precisely the silent success the phase's exit criterion exists to
-- prevent, so precedence is resolved at READ time, not just at write time.
--
-- THE RULE — one tier wins per spot, whole:
--   manual              (1) Alan's override. Always wins. The scraper never
--                           reads, writes, or deletes these.
--   scraped             (2) Authoritative whenever the spot has any.
--   manual-provisional  (3) Placeholder from scraper/seed/load-hours.ts.
--                           Visible ONLY while the spot has zero scraped rows.
--
-- Tiers are never mixed within a spot, so a partial scrape cannot blend a fall
-- schedule into a leftover summer one.
--
-- Two consequences, deliberate:
--   * The scraper's first good run makes provisional rows invisible WITHOUT
--     deleting them. Rollback is `delete from spot_hours where source='scraped'`
--     and prod is back to today's behaviour. Nothing is destroyed to prove the
--     pipeline works.
--   * A spot with no scraped rows falls back to provisional rather than reading
--     "Closed". That is not a violation of "fail loudly" — loudness belongs to
--     the scraper run, which aborts non-zero BEFORE writing when its invariants
--     break (task 4). This fallback only decides what a student sees after a
--     run has already failed loudly somewhere else: stale-but-plausible hours
--     beat a campus where everything claims to be shut.

-- The three tiers are now a closed set: a typo'd source ('scrape', 'Manual')
-- would otherwise rank NULL and silently drop the spot's hours entirely.
alter table spot_hours drop constraint if exists spot_hours_source_check;
alter table spot_hours
  add constraint spot_hours_source_check
  check (source in ('manual', 'scraped', 'manual-provisional'));

-- Precedence resolution filters by (spot_id, source); the existing index is
-- (spot_id, day_of_week), which does not serve it.
create index if not exists spot_hours_spot_id_source_idx
  on spot_hours (spot_id, source);

-- The winning tier's rows, and only those. Everything that asks "when is this
-- spot open?" reads THIS, never spot_hours directly — one definition of
-- precedence, shared by the status view and src/lib/spots.ts.
-- security_invoker so the §3.5 public-read policy on spot_hours still applies.
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
winner as (
  select spot_id, min(tier) as tier
  from ranked
  group by spot_id
)
select r.id, r.spot_id, r.day_of_week, r.opens, r.closes, r.source, r.scraped_at
from ranked r
join winner w on w.spot_id = r.spot_id and w.tier = r.tier;

-- Recreated verbatim from 20260717000500 except for the is_open subquery, which
-- now reads spot_effective_hours. A dropped-and-recreated view LOSES its grants
-- (see 20260717000100) — they are re-issued at the bottom.
drop view spot_current_status;

create view spot_current_status
with (security_invoker = true) as
with live as (
  select
    u.spot_id,
    case
      when u.line <= 3 then 'short'
      when u.line <= 6 then 'normal'
      when u.line is not null then 'long'
    end as line,
    case
      when u.crowd <= 3 then 'empty'
      when u.crowd <= 6 then 'normal'
      when u.crowd is not null then 'packed'
    end as crowd,
    case
      when u.noise <= 3 then 'quiet'
      when u.noise <= 6 then 'normal'
      when u.noise is not null then 'loud'
    end as noise,
    exp(
      -(extract(epoch from (now() - u.created_at)) / 60.0)
      / case when s.category = 'food' then 45.0 else 90.0 end
    ) as w
  from updates u
  join spots s on s.id = u.spot_id
  where not u.hidden
    and not s.frozen
    and u.created_at >= now() - interval '3 hours'
),
weight as (
  select spot_id, sum(w) as w_total
  from live
  group by spot_id
),
last_seen as (
  select u.spot_id, max(u.created_at) as last_update_at
  from updates u
  where not u.hidden
  group by u.spot_id
),
line_vote as (
  select distinct on (spot_id) spot_id, line as verdict
  from (
    select spot_id, line, sum(w) as ws
    from live where line is not null
    group by spot_id, line
  ) t
  order by spot_id, ws desc
),
crowd_vote as (
  select distinct on (spot_id) spot_id, crowd as verdict
  from (
    select spot_id, crowd, sum(w) as ws
    from live where crowd is not null
    group by spot_id, crowd
  ) t
  order by spot_id, ws desc
),
noise_vote as (
  select distinct on (spot_id) spot_id, noise as verdict
  from (
    select spot_id, noise, sum(w) as ws
    from live where noise is not null
    group by spot_id, noise
  ) t
  order by spot_id, ws desc
),
worth as (
  select
    spot_id,
    round(avg((worth_it)::int)::numeric, 2) as worth_it_pct
  from updates
  where worth_it is not null
    and not hidden
    and created_at >= now() - interval '7 days'
  group by spot_id
)
select
  s.id                          as spot_id,
  s.slug,
  s.category,
  coalesce(w.w_total, 0)        as confidence_weight,
  case
    when coalesce(w.w_total, 0) >= 2.0 then 'high'
    when coalesce(w.w_total, 0) >= 0.8 then 'medium'
    else 'low'
  end                          as confidence,
  lv.verdict                   as line,
  cv.verdict                   as crowd,
  nv.verdict                   as noise,
  wr.worth_it_pct,
  ls.last_update_at,
  exists (
    select 1
    from spot_effective_hours h
    cross join lateral (
      select
        (now() at time zone 'America/New_York')::time                 as t,
        extract(dow from (now() at time zone 'America/New_York'))::int as dow
    ) nyt
    where h.spot_id = s.id
      and (
        (h.closes > h.opens
          and h.day_of_week = nyt.dow
          and nyt.t >= h.opens and nyt.t < h.closes)
        or (h.closes <= h.opens
          and h.day_of_week = nyt.dow
          and nyt.t >= h.opens)
        or (h.closes <= h.opens
          and h.day_of_week = (nyt.dow + 6) % 7
          and nyt.t < h.closes)
      )
  )                            as is_open
from spots s
left join weight     w  on w.spot_id  = s.id
left join last_seen  ls on ls.spot_id = s.id
left join line_vote  lv on lv.spot_id = s.id
left join crowd_vote cv on cv.spot_id = s.id
left join noise_vote nv on nv.spot_id = s.id
left join worth      wr on wr.spot_id = s.id
where s.active;

-- Nothing is exposed by default (20260717000100). service_role is covered by
-- that migration's blanket table grant, but views created afterwards are not.
grant select on spot_current_status  to anon, authenticated, service_role;
grant select on spot_effective_hours to anon, authenticated, service_role;
