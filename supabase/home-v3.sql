begin;

create schema if not exists home_v3_private;
revoke all on schema home_v3_private from public;
grant usage on schema home_v3_private to authenticated;

create or replace function home_v3_private.is_member(target uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
  select 1 from public.household_members
  where household_id = target and user_id = (select auth.uid())
 );
$$;
revoke all on function home_v3_private.is_member(uuid) from public;
grant execute on function home_v3_private.is_member(uuid) to authenticated;

create or replace function public.home_v3_households()
returns setof uuid language sql stable security definer set search_path = ''
as $$
 select distinct household_id from public.household_members
 where user_id = (select auth.uid())
 order by household_id;
$$;
revoke all on function public.home_v3_households() from public, anon;
grant execute on function public.home_v3_households() to authenticated;

create table if not exists public.home_v3_records (
 household_id uuid not null references public.households(id) on delete cascade,
 collection text not null check (collection in ('locations','items','history','shopping','chores','wellness','tasks','pets','petRecords','subscriptions','activity','finds','map')),
 record_id text not null check (length(record_id) between 1 and 120),
 owner_id uuid not null default auth.uid() references auth.users(id),
 visibility text not null check (visibility in ('shared', 'private')),
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 1400000),
 revision uuid not null default gen_random_uuid(),
 primary key (household_id, collection, record_id)
);
alter table public.home_v3_records enable row level security;
revoke all on public.home_v3_records from public, anon, authenticated;
grant select, insert, delete on public.home_v3_records to authenticated;
grant update (payload, visibility, revision) on public.home_v3_records to authenticated;

drop policy if exists home_v3_read on public.home_v3_records;
create policy home_v3_read on public.home_v3_records for select to authenticated
 using (home_v3_private.is_member(household_id) and (visibility = 'shared' or owner_id = (select auth.uid())));
drop policy if exists home_v3_insert on public.home_v3_records;
create policy home_v3_insert on public.home_v3_records for insert to authenticated
 with check (home_v3_private.is_member(household_id) and owner_id = (select auth.uid()));
drop policy if exists home_v3_update on public.home_v3_records;
create policy home_v3_update on public.home_v3_records for update to authenticated
 using (home_v3_private.is_member(household_id) and (visibility = 'shared' or owner_id = (select auth.uid())))
 with check (home_v3_private.is_member(household_id) and (visibility = 'shared' or owner_id = (select auth.uid())));
drop policy if exists home_v3_delete on public.home_v3_records;
create policy home_v3_delete on public.home_v3_records for delete to authenticated
 using (home_v3_private.is_member(household_id) and (visibility = 'shared' or owner_id = (select auth.uid())));

create or replace function public.home_v3_apply(target uuid, changes jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
 change jsonb;
 affected integer;
 saved public.home_v3_records%rowtype;
 results jsonb := '[]'::jsonb;
begin
 if not home_v3_private.is_member(target) then
  raise insufficient_privilege using message = 'Household membership required';
 end if;
 for change in select value from jsonb_array_elements(changes)
 loop
  if change->>'revision' is null then
   insert into public.home_v3_records (household_id, collection, record_id, visibility, payload)
   values (target, change->>'collection', change->>'record_id', change->>'visibility', change->'payload')
   on conflict do nothing returning * into saved;
  elsif change->>'payload' is null then
   delete from public.home_v3_records
   where household_id = target and collection = change->>'collection' and record_id = change->>'record_id'
    and revision = (change->>'revision')::uuid
   returning * into saved;
  else
   update public.home_v3_records
   set payload = change->'payload', visibility = change->>'visibility', revision = gen_random_uuid()
   where household_id = target and collection = change->>'collection' and record_id = change->>'record_id'
    and revision = (change->>'revision')::uuid
   returning * into saved;
  end if;
  get diagnostics affected = row_count;
  if affected <> 1 then
   raise sqlstate '40001' using message = 'Record changed or is unavailable';
  end if;
  if change->>'payload' is null then
   saved.payload := null;
  end if;
  results := results || jsonb_build_array(to_jsonb(saved));
 end loop;
 return results;
end;
$$;
revoke all on function public.home_v3_apply(uuid,jsonb) from public, anon;
grant execute on function public.home_v3_apply(uuid,jsonb) to authenticated;
commit;
