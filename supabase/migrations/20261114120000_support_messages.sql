create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sender_name text not null check (length(sender_name) between 2 and 100),
  sender_email text not null check (length(sender_email) <= 254),
  category text not null check (category in ('question', 'suggestion', 'issue')),
  subject text not null check (length(subject) between 3 and 160),
  message text not null check (length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'read', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_messages_status_created_at_idx
  on public.support_messages (status, created_at desc);

alter table public.support_messages enable row level security;

create or replace function public.is_facturo_admin()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'james.m.nyabenda@gmail.com'
$$;

revoke all on function public.is_facturo_admin() from public, anon;
grant execute on function public.is_facturo_admin() to authenticated;

create policy support_messages_insert_own
  on public.support_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and company_id = (select public.current_company_id())
    and lower(sender_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and status = 'new'
  );

create policy support_messages_admin_select
  on public.support_messages
  for select to authenticated
  using ((select public.is_facturo_admin()));

create policy support_messages_admin_update
  on public.support_messages
  for update to authenticated
  using ((select public.is_facturo_admin()))
  with check ((select public.is_facturo_admin()));

revoke all on table public.support_messages from anon, authenticated;
grant insert (company_id, user_id, sender_name, sender_email, category, subject, message)
  on public.support_messages to authenticated;
grant select on public.support_messages to authenticated;
grant update (status, updated_at) on public.support_messages to authenticated;
