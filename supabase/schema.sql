-- Moj OS — šema baze (Supabase)
-- Jedna tabela za sve vrste zapisa: prostori, projekti, zadaci, događaji, beleške i podešavanja.
-- Svaki korisnik vidi i menja samo svoje redove (Row Level Security).
-- Bezbedno je pokrenuti više puta.

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  coll       text        not null check (coll in ('spaces', 'projects', 'tasks', 'events', 'notes', 'settings')),
  id         text        not null check (char_length(id) between 1 and 120),
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, coll, id)
);

alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;

create policy "records_select_own" on public.records for select to authenticated using ((select auth.uid()) = user_id);
create policy "records_insert_own" on public.records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "records_update_own" on public.records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "records_delete_own" on public.records for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.records to authenticated;

-- Promene uživo između uređaja (Realtime)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;
