-- crowd + noise: word enums → 1–10 scores (Alan, 2026-07-17 — "everything
-- should be consistent" with the line slider). crowd: 1 = empty, 10 =
-- packed. noise: 1 = silent, 10 = loud. Same design as the line migration
-- (20260717000400): raw score stored, the view bands to the §4.3 words
-- before the §5.2 weighted band-vote, so display and downstream types are
-- unchanged. Baseline JSONB keeps its own word vocabulary (§3.4) — it is
-- editorial, not measured.

drop view spot_current_status;

alter table updates drop constraint if exists updates_crowd_check;
alter table updates
  alter column crowd type smallint
  using (
    case crowd
      when 'empty' then 2
      when 'normal' then 5
      when 'packed' then 8
      else null
    end
  );
alter table updates
  add constraint updates_crowd_check check (crowd between 1 and 10);

alter table updates drop constraint if exists updates_noise_check;
alter table updates
  alter column noise type smallint
  using (
    case noise
      when 'quiet' then 2
      when 'normal' then 5
      when 'loud' then 8
      else null
    end
  );
alter table updates
  add constraint updates_noise_check check (noise between 1 and 10);

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
    from spot_hours h
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

grant select on spot_current_status to anon, authenticated, service_role;
