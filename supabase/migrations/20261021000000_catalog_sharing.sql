-- Liens publics révocables pour partager uniquement les articles actifs du catalogue.
create table if not exists public.catalog_shares (
  company_id uuid primary key references public.companies (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);

alter table public.catalog_shares enable row level security;
drop policy if exists catalog_shares_select_own on public.catalog_shares;
create policy catalog_shares_select_own on public.catalog_shares
for select to authenticated using (company_id = (select public.current_company_id()));
drop policy if exists catalog_shares_insert_own on public.catalog_shares;
create policy catalog_shares_insert_own on public.catalog_shares
for insert to authenticated with check (company_id = (select public.current_company_id()));
drop policy if exists catalog_shares_delete_own on public.catalog_shares;
create policy catalog_shares_delete_own on public.catalog_shares
for delete to authenticated using (company_id = (select public.current_company_id()));
revoke all on public.catalog_shares from anon, authenticated;
grant select, insert, delete on public.catalog_shares to authenticated;

create or replace function public.get_shared_catalog(p_token text)
returns table (company_name text, name text, price_amount text, currency public.invoice_currency, unit text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.company_name, ci.name, ci.price_amount::text, ci.currency, ci.unit
  from public.catalog_shares s
  join public.companies c on c.id = s.company_id
  join public.catalog_items ci on ci.company_id = s.company_id and ci.is_active
  where s.token = p_token
  order by ci.name;
$$;
revoke all on function public.get_shared_catalog(text) from public;
grant execute on function public.get_shared_catalog(text) to anon, authenticated;
