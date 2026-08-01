-- SECURITY FIX: replace_scraped_hours was callable by anon in production.
--
-- WHAT HAPPENED. 20260731000100 ended with `revoke all on function ... from
-- public`, on the assumption that this strips the default EXECUTE that Postgres
-- gives new functions. It does — but only the PUBLIC grant. Supabase also ships
-- a DEFAULT ACL that grants EXECUTE on new public-schema functions to anon and
-- authenticated BY NAME:
--
--   pg_default_acl: postgres | f | {postgres=X/postgres,anon=X/postgres,
--                                   authenticated=X/postgres,service_role=X/postgres}
--
-- An explicit grant to a named role is not touched by revoking from PUBLIC, so
-- anon kept EXECUTE. Since the function is SECURITY DEFINER and reachable over
-- PostgREST, any holder of the anon key — which ships in the client bundle by
-- design — could rewrite every spot's hours on campus. Confirmed against prod:
-- an anon POST reached the function body and returned its P0001 validation
-- error rather than 42501.
--
-- WHY LOCAL TESTING MISSED IT. This local instance carries a narrowed default
-- ACL (`postgres | f | {postgres=X/postgres}`), so the same migration produced
-- proacl {postgres=X,service_role=X} locally and the anon call was correctly
-- denied. The test passed for an environmental reason, not because the code was
-- right. The pgTAP suite now asserts the ACL itself via function_privs_are(),
-- which is deterministic across environments — a status code from one instance
-- is not evidence about another.
--
-- THE STANDING RULE, alongside the one in 20260717000100 (every new table/view
-- needs its own grants): EVERY new function must revoke EXECUTE from anon and
-- authenticated BY NAME. Revoking from PUBLIC is not sufficient on Supabase.
-- Exception, deliberate: flag_update keeps anon EXECUTE — §5.5 comment flagging
-- is a client-side call and is rate-limited inside the function.

revoke execute on function replace_scraped_hours(jsonb) from public;
revoke execute on function replace_scraped_hours(jsonb) from anon;
revoke execute on function replace_scraped_hours(jsonb) from authenticated;

-- The scraper authenticates with the service role key, held only as a GitHub
-- Actions secret (§0.10 — nothing secret in the client bundle).
grant execute on function replace_scraped_hours(jsonb) to service_role;
