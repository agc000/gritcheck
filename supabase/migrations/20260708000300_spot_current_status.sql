-- spot_current_status — BUILD_PLAN §5.4. The one deliberately sophisticated view.
-- Per spot it computes: the decay-weighted verdict per field, the confidence
-- weight W and its bucket, last_update_at, and open/closed from spot_hours in
-- America/New_York (handling hours that cross midnight).
--
-- Tuning constants (§5.1, §5.3) — logged here, not scattered as magic numbers.
-- Re-tune with real data in week 2 of launch:
--   TAU_FOOD   = 45 min  (lines change fast)
--   TAU_STUDY  = 90 min  (rooms change slower)
--   WINDOW     = 3 hours  (updates older than this are ignored entirely)
--   W >= 2.0 -> High, 0.8 <= W < 2.0 -> Medium, W < 0.8 -> Low (baseline shown)
--   Worth-it %: weighted share of worth_it = true over a trailing 7 days (slow signal).
--
-- Guardrail (§5.4): a "quiet" update from 11 AM must never render as current at
-- 3 PM. The 3-hour WHERE cutoff enforces that; a spike test lives with the
-- Edge Function work in Phase 4.

create or replace view spot_current_status
with (security_invoker = true) as
with live as (
  -- Every non-hidden update inside the 3-hour window, with its decay weight.
  -- frozen spots (§5.5) drop their live data and fall back to baseline-only.
  select
    u.spot_id,
    u.line,
    u.crowd,
    u.noise,
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
  -- last_update_at ignores the 3h cutoff so the UI can say "no reports since 11 AM".
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
  -- Deliberately a separate, slower window than the status decay (§5.2).
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
  -- Open now? Evaluate spot_hours against NY wall-clock time, covering both the
  -- same-day window and the two halves of a window that crosses midnight.
  exists (
    select 1
    from spot_hours h
    cross join lateral (
      select
        (now() at time zone 'America/New_York')::time                 as t,
        extract(dow from (now() at time zone 'America/New_York'))::int as dow
    ) nyt
    where h.spot_id = s.id
      and (
        -- normal window: closes after opens, same calendar day
        (h.closes > h.opens
          and h.day_of_week = nyt.dow
          and nyt.t >= h.opens and nyt.t < h.closes)
        -- crosses midnight, evening half: today, after opening
        or (h.closes <= h.opens
          and h.day_of_week = nyt.dow
          and nyt.t >= h.opens)
        -- crosses midnight, morning half: yesterday's window still running
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
