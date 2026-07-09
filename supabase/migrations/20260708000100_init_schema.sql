-- GritCheck initial schema — BUILD_PLAN §3.1.
-- The schema is code (§2.3): this file is the source of truth, checked into git,
-- applied with `supabase db push`. RLS lives in the next migration.

-- Places with live status. One row per *zone* (floor-level granularity is the moat).
create table spots (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,              -- 'ilsb-2nd-floor'
  name text not null,                     -- 'ILSB — 2nd Floor'
  category text not null check (category in ('food','study')), -- 'gym' later, zero migration
  building text not null,
  lat double precision not null,
  lng double precision not null,
  attributes jsonb not null default '{}', -- §3.2 static filter attributes
  consensus text,                         -- one editorial sentence (§3.3)
  baseline jsonb not null default '{}',   -- typical conditions by day-part (§3.4)
  active boolean not null default true,
  frozen boolean not null default false,  -- §5.5 kill switch: pin to baseline during abuse
  created_at timestamptz not null default now()
);

-- Scraped or manual open hours, replaced per scrape run.
-- day_of_week uses Postgres dow: 0 = Sunday .. 6 = Saturday. The scraper and the
-- spot_current_status view both depend on that convention — do not change it.
create table spot_hours (
  id bigint generated always as identity primary key,
  spot_id uuid not null references spots(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  opens time not null,
  closes time not null,                   -- may cross midnight (closes <= opens); view handles it
  source text not null default 'scraped', -- 'scraped' | 'manual'
  scraped_at timestamptz not null default now()
);
create index on spot_hours (spot_id, day_of_week);

-- Anonymous student updates. Append-only. Writes go ONLY through the Edge Function
-- (service role); there is deliberately no anon insert policy (§3.5).
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
  name text not null,                     -- 'open_app','view_spot','submit_update',...
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
