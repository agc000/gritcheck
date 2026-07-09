-- Row Level Security — BUILD_PLAN §3.5. Non-negotiable (§0.10).
-- Reads are public where safe; ALL writes to `updates` are denied to anon and
-- go only through the submit-update Edge Function (service role), which enforces
-- rate limits. No update/delete policies exist anywhere.

alter table spots      enable row level security;
alter table spot_hours enable row level security;
alter table updates    enable row level security;
alter table events     enable row level security;

create policy "public read spots"   on spots      for select using (active);
create policy "public read hours"   on spot_hours for select using (true);
create policy "public read updates" on updates    for select using (not hidden);
create policy "insert events"       on events     for insert with check (true);

-- NO insert policy on updates for anon: writes go ONLY through the Edge Function
-- (service role), which bypasses RLS and enforces §5.5 rate limits.
-- The scraper writes spot_hours with the service role key (GitHub Actions secret),
-- which also bypasses RLS — so no anon write policy is needed there either.
