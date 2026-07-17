-- Explicit data-plane grants. Supabase no longer auto-exposes public-schema
-- entities to the API roles (anon/authenticated/service_role) — the legacy
-- auto-grant is deprecated and removed 2026-10-30 (see the note in
-- supabase/config.toml). Discovered locally: even service_role gets
-- "permission denied" without these.
--
-- The §3.5 security posture is therefore two layers:
--   grants  = which VERBS a role may use on a table (this file)
--   RLS     = which ROWS those verbs can touch (§3.5 policies)
-- service_role bypasses RLS but still needs table grants.
--
-- Every FUTURE migration that creates a table/view/sequence must include its
-- own grants — nothing is exposed by default anymore.

-- Public reads. RLS still filters: active spots, non-hidden updates.
grant select on spots, spot_hours, updates, spot_current_status
  to anon, authenticated;

-- Product analytics (§3.1): write-only from the client.
grant insert on events to anon, authenticated;
-- events.id is an identity column; inserting needs USAGE on its sequence.
grant usage, select on sequence events_id_seq to anon, authenticated;

-- Edge Function + scraper run as service_role: full data-plane, including
-- update_rate_limits (which deliberately has NO anon grants and no policies).
grant select, insert, update, delete on all tables in schema public
  to service_role;
grant usage, select on all sequences in schema public to service_role;
