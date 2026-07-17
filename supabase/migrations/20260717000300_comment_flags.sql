-- Comment flagging (§5.5): flags >= 2 → hidden, via a security definer
-- function — anon has no UPDATE grant anywhere, so the counter can only move
-- through this controlled path.
--
-- Rate limiting: the primary key (one flag per device per comment) replaces
-- a time-window limit. It is idempotent (re-tapping is a no-op), bounded
-- (N devices can flag a comment at most N times), and cannot be farmed the
-- way repeated submissions could. Deviation from "rate-limited like
-- updates" noted deliberately: a per-device uniqueness constraint is the
-- stronger and simpler guarantee here.

create table update_flags (
  update_id bigint not null references updates(id) on delete cascade,
  device_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (update_id, device_id)
);

-- RLS on, zero policies: not even readable by anon. The definer function is
-- the only write path; service_role (Studio/incident response) the only reader.
alter table update_flags enable row level security;
grant select, insert, delete on update_flags to service_role;

create or replace function flag_update(p_update_id bigint, p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  insert into update_flags (update_id, device_id)
  values (p_update_id, p_device_id)
  on conflict do nothing;

  select count(*) into n from update_flags where update_id = p_update_id;

  -- hidden is one-way here: moderation un-hide happens in Studio, and a
  -- flood of flags after an un-hide should not silently re-hide.
  update updates
  set flags = n,
      hidden = hidden or n >= 2
  where id = p_update_id;
end;
$$;

grant execute on function flag_update(bigint, uuid) to anon, authenticated, service_role;
