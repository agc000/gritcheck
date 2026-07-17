-- Realtime on `updates` (§5.4): clients subscribe to INSERTs and refetch the
-- aggregation view. Postgres Changes respects RLS — anon subscribers only see
-- rows the "public read updates" policy (not hidden) would let them SELECT,
-- and the grants migration already gave anon SELECT on the table.
alter publication supabase_realtime add table updates;
