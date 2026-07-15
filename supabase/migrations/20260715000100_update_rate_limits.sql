-- update_rate_limits — BUILD_PLAN §5.5 rate-limit storage for the submit-update
-- Edge Function. One row per accepted update, keyed by BOTH independent limit
-- keys (device and hashed IP), so the function can count recent rows per key.
--
-- Limits enforced in the Edge Function (constants live there, not here):
--   device: 1 update per spot per 10 min; 12 per day
--   ip:     3 updates per spot per 10 min; 30 per day
--
-- Why a separate table instead of counting rows in `updates`:
--   1. `updates` has no IP column, and adding one would expose raw/hashed IPs
--      through the "public read updates" RLS policy (§3.5) — anon can select
--      every column of a readable row.
--   2. Rate accounting must survive moderation: hiding an update should not
--      refund the submitter's quota.
--
-- IPs are stored ONLY as salted SHA-256 hashes (salt = IP_HASH_SALT secret,
-- set via `supabase secrets set`); the raw IP never touches the database.

create table update_rate_limits (
  id bigint generated always as identity primary key,
  device_id uuid not null,
  ip_hash text not null,
  spot_id uuid not null references spots(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- The function's counts are "rows for this key since T", so key-first,
-- time-ordered indexes serve all four checks (per-spot filters are cheap
-- residuals at this table's scale).
create index on update_rate_limits (device_id, created_at desc);
create index on update_rate_limits (ip_hash, created_at desc);

-- RLS on, deliberately ZERO policies: anon and authenticated can neither read
-- nor write. Only the Edge Function's service-role client touches this table.
alter table update_rate_limits enable row level security;
