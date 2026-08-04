# GritCheck — how to read the numbers

The launch-week runbook for §7.4. Two places to look, and everything here is a
plain `SELECT` — safe to run any time, in any order.

**Where:**
- **Vercel dashboard → your project → Analytics** — page views, top pages,
  referrers, device/browser split. Answers *"how much traffic"*.
- **Supabase dashboard → SQL Editor** — everything product-specific, from the
  first-party `events` table. Answers *"what did people actually do"*.
  Paste a query below and hit Run; save the ones you check weekly.

**Two caveats that change how you read all of this:**

1. **iOS installs create a new device.** Adding GritCheck to an iPhone home
   screen gives it a storage container separate from Safari, so `device_id`
   is regenerated. One human who browsed in Safari and then installed appears
   as **two devices**. Unique-device counts drift high as installs rise —
   which is why several queries below segment by `standalone` instead of
   trusting raw totals.
2. **Offline sessions are invisible.** Analytics inserts need the network, and
   pages are NetworkFirst — a cached page means the network already failed.
   Slight undercount, by design; not worth fixing.

All timestamps are UTC in the database; queries that group by day convert to
`America/New_York` so "day" means a campus day.

---

## 1. Did people show up? (DAU / WAU)

```sql
select
  count(distinct device_id) filter (
    where created_at >= (date_trunc('day', now() at time zone 'America/New_York')
                         at time zone 'America/New_York')
  ) as devices_today,
  count(distinct device_id) filter (where created_at >= now() - interval '7 days')  as wau,
  count(distinct device_id) filter (where created_at >= now() - interval '30 days') as mau,
  count(*) filter (where created_at >= now() - interval '7 days') as opens_7d
from events
where name = 'open_app';
```

## 1b. How many actual PEOPLE — the number to quote

Section 1 counts *storage containers*, not humans. On iOS, installing to the
home screen creates a container separate from Safari, so one person who browsed
and then installed is **two** `device_id`s. Raw lifetime uniques are therefore
an over-count, and it grows with every install.

`acquisition_src = '(pre-install)'` identifies exactly those duplicates: it is
written when a container's *very first* open is already a home-screen launch,
which on iOS can only happen to someone who was in Safari first (you cannot
install without visiting). So subtracting that bucket un-inflates the total.

```sql
with per_device as (
  select
    device_id,
    max(props ->> 'acquisition_src') as acquisition_src  -- written once, never changes
  from events
  where name = 'open_app' and device_id is not null
  group by device_id
)
select
  count(*)                                                  as containers,      -- raw, the UPPER bound
  count(*) filter (where acquisition_src = '(pre-install)') as ios_duplicates,
  count(*) filter (where acquisition_src is distinct from '(pre-install)')
                                                            as people_estimate  -- the number to quote
from per_device;
```

**Quote `people_estimate`, and say it's an estimate.** Being able to explain
*why* it differs from the raw count is worth more in an interview than a bigger
number: it shows you know what your telemetry actually measures.

**Residual error, both directions, small:** it slightly *under*-counts anyone
who installed on two devices (iPhone and iPad are genuinely two containers for
one person, and both look like duplicates). It slightly *over*-counts if a
Safari visit happened in private mode, since no persistent container was written
to pair with. Neither is worth engineering around.

**Do NOT apply this subtraction to DAU/WAU in section 1.** Different question,
opposite error. An installed iOS user is *active* through their installed
container — filtering out `(pre-install)` devices would delete your most engaged
users from the daily count. Double-counting in DAU only happens if someone opens
*both* Safari and the installed app on the same day, which is rare because
installing is precisely how people stop using Safari for it. Section 1 is close
enough; section 1b is for the lifetime total.

**Why there is no true de-duplication:** linking the two containers would mean
smuggling the old `device_id` into the installed app through the manifest's
`start_url` at install time. That is a real technique and it is also fragile
across iOS versions, so it is deliberately not built (§0.3). The bucket is
measured instead of guessed, which is enough to state a defensible number.

## 2. Daily trend (the one to watch during launch week)

```sql
select
  (created_at at time zone 'America/New_York')::date as day,
  count(*)                    as opens,
  count(distinct device_id)   as devices
from events
where name = 'open_app'
  and created_at >= now() - interval '21 days'
group by 1
order by 1 desc;
```

## 3. Installed app vs browser

Reads the `standalone` flag on `open_app`. This is your install-adoption
number, and the honest way to segment everything else.

```sql
select
  coalesce(props->>'standalone', 'unknown') as standalone,
  count(*)                  as opens,
  count(distinct device_id) as devices
from events
where name = 'open_app'
  and created_at >= now() - interval '7 days'
group by 1
order by opens desc;
```

## 4a. Which flyer/QR actually acquired people — **the printing decision**

`acquisition_src` is written on a device's first visit and never overwritten,
so it survives installing to the home screen. Put a distinct `?src=` on every
code you print — `gritcheck.live/?src=qr-commons`, `?src=qr-aok`,
`?src=flyer-dorm`.

```sql
select
  coalesce(props->>'acquisition_src', '(unset)') as acquisition_src,
  count(distinct device_id) as devices,
  count(*)                  as opens
from events
where name = 'open_app'
  and created_at >= now() - interval '30 days'
group by 1
order by devices desc;
```

Read `devices`, not `opens` — you're counting people acquired, not visits.

Two buckets that aren't placements:
- `(direct)` — no `?src=` on their first visit: typed it, bookmark, untagged share.
- `(pre-install)` — an iOS user whose first visit *in that storage container*
  was already a home-screen launch. iOS gives installed apps storage separate
  from Safari, so their original flyer/QR is unrecoverable. **The size of this
  bucket is the measurement of what iOS costs you in attribution** — it isn't
  a bug, and it doesn't exist on Android.

## 4b. How they got in *this* time

`launch_src` is per-open: `homescreen` for installed launches, a `?src=` when
they tapped a tagged link, `(direct)` otherwise. This is engagement, not
acquisition — a returning student shows `(direct)` or `homescreen` no matter
which flyer first brought them.

```sql
select
  coalesce(props->>'launch_src', '(unset)') as launch_src,
  count(*)                  as opens,
  count(distinct device_id) as devices
from events
where name = 'open_app'
  and created_at >= now() - interval '7 days'
group by 1
order by opens desc;
```

## 5. Install funnel

`install_shown → install_answered → actually launching installed`.

```sql
select
  count(*) filter (where name = 'install_shown')                              as prompt_shown,
  count(*) filter (where name = 'install_answered'
                     and props->>'answer' = 'accepted')                       as accepted_android,
  count(*) filter (where name = 'install_answered'
                     and props->>'answer' = 'got-it')                         as acknowledged_ios,
  count(*) filter (where name = 'install_answered'
                     and props->>'answer' in ('not-now','swiped','declined')) as dismissed,
  count(distinct device_id) filter (where name = 'open_app'
                     and props->>'standalone' = 'true')                       as devices_launching_installed
from events
where created_at >= now() - interval '30 days';
```

> iOS can't report a real install — Apple gives no `beforeinstallprompt` and no
> install event, so `acknowledged_ios` only means they tapped "Got it". The
> honest iOS install signal is `devices_launching_installed`.

## 6. D7 return rate

Of the devices whose *first* open was 8–14 days ago, how many came back at
least 7 days later. This is the retention number that matters.

```sql
with firsts as (
  select device_id, min(created_at) as first_open
  from events
  where name = 'open_app'
  group by 1
),
cohort as (
  select device_id, first_open
  from firsts
  where first_open <  now() - interval '7 days'
    and first_open >= now() - interval '14 days'
),
flagged as (
  select
    c.device_id,
    exists (
      select 1 from events e
      where e.device_id = c.device_id
        and e.name = 'open_app'
        and e.created_at >= c.first_open + interval '7 days'
    ) as returned
  from cohort c
)
select
  count(*)                          as cohort_size,
  count(*) filter (where returned)  as returned_d7,
  round(100.0 * count(*) filter (where returned) / nullif(count(*), 0), 1) as d7_pct
from flagged;
```

## 7. Updates per day, and how many came from the follow-up prompt

Ground truth from the `updates` table itself, not from analytics events.
`kind = 'followup'` is a reply to "Did X pan out?"; anything else came from the
Update button.

```sql
select
  (created_at at time zone 'America/New_York')::date as day,
  count(*)                                   as updates,
  count(*) filter (where kind = 'followup')  as from_followup,
  round(100.0 * count(*) filter (where kind = 'followup')
        / nullif(count(*), 0), 1)            as followup_pct
from updates
where created_at >= now() - interval '21 days'
group by 1
order by 1 desc;
```

## 8. Contribution rate — the number this product lives on

What share of active devices actually reported something. If this collapses,
the live layer dies and every verdict falls back to "typical".

```sql
select
  count(distinct e.device_id) as active_devices,
  count(distinct u.device_id) as contributing_devices,
  round(100.0 * count(distinct u.device_id)
        / nullif(count(distinct e.device_id), 0), 1) as contribution_pct
from events e
left join updates u
  on u.device_id = e.device_id
 and u.created_at >= now() - interval '7 days'
where e.name = 'open_app'
  and e.created_at >= now() - interval '7 days';
```

## 9. Did they reach an answer fast? (§7.4's <10 s metric)

```sql
select
  count(*)                                                          as detail_views,
  count(*) filter (where (props->>'ms_since_open')::int < 10000)    as under_10s,
  round(100.0 * count(*) filter (where (props->>'ms_since_open')::int < 10000)
        / nullif(count(*), 0), 1)                                   as pct_under_10s,
  round(avg((props->>'ms_since_open')::int) / 1000.0, 1)            as avg_seconds
from events
where name = 'view_spot'
  and props ? 'ms_since_open'
  and created_at >= now() - interval '7 days';
```

## 10. Which spots people actually care about

Drives where to spend data effort — the most-viewed spot with the least data
is your next seeding job.

```sql
select
  props->>'slug'            as slug,
  count(*)                  as views,
  count(distinct device_id) as devices
from events
where name = 'view_spot'
  and created_at >= now() - interval '7 days'
group by 1
order by views desc
limit 15;
```

---

**Weekly ritual:** run 1, 2, 3, 7 and 8. Those five tell you whether the
product is alive: people arriving, coming back, and — the one that actually
matters — *contributing*. Everything else is diagnosis for when one of those
moves.

**Vanity metrics** (raw page views, likes) get logged but never drive
decisions — §7.4.
