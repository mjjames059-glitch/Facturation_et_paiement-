-- Schéma initial de Facturo. À exécuter dans le SQL Editor Supabase ou avec la CLI.
create extension if not exists pgcrypto;

create type public.client_type as enum ('b2b', 'b2a', 'b2c');
create type public.invoice_currency as enum ('USD', 'CDF');
create type public.invoice_state as enum ('draft', 'sent', 'paid');
create type public.payment_mode as enum ('cash', 'bank_transfer', 'check', 'mobile_money', 'other');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  company_name text not null,
  legal_name text,
  sector text not null,
  served_client_types public.client_type[] not null default '{}',
  vat_status text not null check (vat_status in ('yes', 'no', 'unknown')),
  logo_path text,
  address text,
  phone text,
  rccm text,
  nif text,
  next_invoice_number bigint not null default 1 check (next_invoice_number > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null unique references public.companies (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  client_type public.client_type not null,
  whatsapp_phone text,
  email text,
  address text,
  nif text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_nif_required_for_organizations
    check (client_type = 'b2c' or nullif(trim(nif), '') is not null),
  unique (id, company_id)
);

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  price_amount bigint not null check (price_amount >= 0),
  currency public.invoice_currency not null,
  unit text not null check (length(trim(unit)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid not null,
  invoice_number text not null,
  currency public.invoice_currency not null,
  issued_at date not null default current_date,
  due_date date not null,
  order_reference text,
  total_amount bigint not null default 0 check (total_amount >= 0),
  status public.invoice_state not null default 'draft',
  fiscal_status text,
  fiscal_code text,
  def_id text,
  qr_data text,
  certified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_client_same_company
    foreign key (client_id, company_id) references public.clients (id, company_id),
  constraint invoices_dates_valid check (due_date is null or due_date >= issued_at),
  unique (company_id, invoice_number)
);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  catalog_item_id uuid references public.catalog_items (id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  unit text not null default 'unité',
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  line_total bigint generated always as (round(quantity * unit_price)::bigint) stored,
  created_at timestamptz not null default now()
);

create or replace function public.validate_invoice_line_catalog_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.catalog_item_id is not null and not exists (
    select 1
    from public.catalog_items ci
    join public.invoices i on i.id = new.invoice_id
    where ci.id = new.catalog_item_id
      and ci.company_id = i.company_id
      and ci.currency = i.currency
  ) then
    raise exception 'Article du catalogue introuvable ou dans une autre devise' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger invoice_lines_validate_catalog_item
before insert or update on public.invoice_lines
for each row execute function public.validate_invoice_line_catalog_item();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  amount bigint not null check (amount > 0),
  paid_at date not null default current_date,
  mode public.payment_mode not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.waitlist_dgi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now()
);

create table public.settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  exchange_rate numeric(14, 4) not null default 2800 check (exchange_rate > 0),
  updated_at timestamptz not null default now()
);

comment on column public.catalog_items.price_amount is 'USD : centimes ; CDF : unités entières.';
comment on column public.invoice_lines.unit_price is 'USD : centimes ; CDF : unités entières.';
comment on column public.invoices.total_amount is 'USD : centimes ; CDF : unités entières.';
comment on column public.payments.amount is 'USD : centimes ; CDF : unités entières.';

create index clients_company_id_idx on public.clients (company_id);
create index catalog_items_company_id_active_idx on public.catalog_items (company_id, is_active);
create index invoices_company_date_idx on public.invoices (company_id, issued_at desc);
create index invoices_company_due_date_idx on public.invoices (company_id, due_date);
create index invoice_lines_invoice_id_idx on public.invoice_lines (invoice_id);
create index payments_invoice_id_idx on public.payments (invoice_id);

-- Fonction utilisée par les politiques RLS. SECURITY DEFINER évite une récursion
-- lorsque les politiques doivent retrouver l’entreprise depuis le profil courant.
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.company_id from public.profiles p where p.user_id = auth.uid()
$$;

revoke all on function public.current_company_id() from public;
grant execute on function public.current_company_id() to authenticated;

-- Le total est toujours recalculé depuis les lignes, en arithmétique entière.
create or replace function public.refresh_invoice_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_invoice_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_invoice_id := old.invoice_id;
  else
    affected_invoice_id := new.invoice_id;
  end if;
  update public.invoices i
  set total_amount = coalesce((select sum(l.line_total) from public.invoice_lines l where l.invoice_id = affected_invoice_id), 0),
      updated_at = now()
  where i.id = affected_invoice_id;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger invoice_lines_refresh_total
after insert or update or delete on public.invoice_lines
for each row execute function public.refresh_invoice_total();

-- Un numéro est attribué dans la même transaction que la facture et ses lignes.
-- Un rollback annule aussi l'incrément. Les factures ne sont pas supprimables.
create or replace function public.create_invoice_with_lines(
  p_client_id uuid,
  p_currency public.invoice_currency,
  p_issued_at date,
  p_due_date date,
  p_order_reference text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_client_type public.client_type;
  v_number bigint;
  v_invoice_id uuid;
  v_line jsonb;
  v_description text;
  v_unit text;
  v_quantity numeric(14, 3);
  v_unit_price bigint;
  v_catalog_item_id uuid;
begin
  select p.company_id into v_company_id
  from public.profiles p
  where p.user_id = auth.uid();

  if v_company_id is null then
    raise exception 'Profil d’entreprise introuvable' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La facture doit contenir au moins une ligne' using errcode = '22023';
  end if;

  select c.client_type into v_client_type
  from public.clients c
  where c.id = p_client_id and c.company_id = v_company_id;
  if v_client_type is null then
    raise exception 'Client introuvable pour cette entreprise' using errcode = '23503';
  end if;
  if v_client_type <> 'b2a' and nullif(trim(p_order_reference), '') is not null then
    raise exception 'La référence de marché est réservée aux administrations' using errcode = '22023';
  end if;

  update public.companies c
  set next_invoice_number = c.next_invoice_number + 1,
      updated_at = now()
  where c.id = v_company_id
  returning c.next_invoice_number - 1 into v_number;

  insert into public.invoices (company_id, client_id, invoice_number, currency, issued_at, due_date, order_reference)
  values (
    v_company_id,
    p_client_id,
    'F-' || case when length(v_number::text) < 4 then lpad(v_number::text, 4, '0') else v_number::text end,
    p_currency,
    p_issued_at,
    p_due_date,
    nullif(trim(p_order_reference), '')
  )
  returning id into v_invoice_id;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_description := nullif(trim(v_line ->> 'description'), '');
    v_unit := coalesce(nullif(trim(v_line ->> 'unit'), ''), 'unité');
    v_quantity := (v_line ->> 'quantity')::numeric(14, 3);
    v_unit_price := (v_line ->> 'unit_price')::bigint;
    v_catalog_item_id := nullif(v_line ->> 'catalog_item_id', '')::uuid;

    if v_description is null or v_quantity <= 0 or v_unit_price < 0 then
      raise exception 'Ligne de facture invalide' using errcode = '22023';
    end if;
    if v_catalog_item_id is not null and not exists (
      select 1 from public.catalog_items ci
      where ci.id = v_catalog_item_id and ci.company_id = v_company_id and ci.currency = p_currency
    ) then
      raise exception 'Article du catalogue introuvable ou dans une autre devise' using errcode = '23503';
    end if;

    insert into public.invoice_lines (invoice_id, catalog_item_id, description, unit, quantity, unit_price)
    values (v_invoice_id, v_catalog_item_id, v_description, v_unit, v_quantity, v_unit_price);
  end loop;

  return v_invoice_id;
end;
$$;

create or replace function public.mark_invoice_sent(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select p.company_id into v_company_id from public.profiles p where p.user_id = auth.uid();
  update public.invoices i
  set status = 'sent', updated_at = now()
  where i.id = p_invoice_id and i.company_id = v_company_id and i.status = 'draft';
  if not found then
    raise exception 'Brouillon introuvable pour cette entreprise' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.mark_invoice_paid_after_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.invoices i
  set status = 'paid', updated_at = now()
  where i.id = new.invoice_id
    and i.status <> 'draft'
    and (select coalesce(sum(p.amount), 0) from public.payments p where p.invoice_id = i.id) >= i.total_amount;
  return new;
end;
$$;

create trigger payments_mark_invoice_paid
after insert on public.payments
for each row execute function public.mark_invoice_paid_after_payment();

create view public.invoice_status_summary
with (security_invoker = true)
as
select
  i.id,
  i.company_id,
  i.client_id,
  i.invoice_number,
  i.currency,
  i.issued_at,
  i.due_date,
  i.order_reference,
  i.total_amount::text as total_amount,
  i.status as stored_status,
  case
    when i.status = 'paid' then 'paid'
    when i.status = 'sent' and i.due_date < current_date then 'overdue'
    else i.status::text
  end as effective_status,
  coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0)::text as paid_amount
from public.invoices i;

-- Toutes les tables exposées par l'API Supabase appliquent le cloisonnement RLS.
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.catalog_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;
alter table public.waitlist_dgi enable row level security;
alter table public.settings enable row level security;

create policy companies_select_own on public.companies
for select to authenticated using (id = (select public.current_company_id()));
create policy companies_update_own on public.companies
for update to authenticated using (id = (select public.current_company_id()))
with check (id = (select public.current_company_id()));

create policy profiles_select_own on public.profiles
for select to authenticated using (user_id = auth.uid());
create policy profiles_update_own on public.profiles
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy clients_select_own on public.clients
for select to authenticated using (company_id = (select public.current_company_id()));
create policy clients_insert_own on public.clients
for insert to authenticated with check (company_id = (select public.current_company_id()));
create policy clients_update_own on public.clients
for update to authenticated using (company_id = (select public.current_company_id()))
with check (company_id = (select public.current_company_id()));
create policy clients_delete_own on public.clients
for delete to authenticated using (company_id = (select public.current_company_id()));

create policy catalog_items_select_own on public.catalog_items
for select to authenticated using (company_id = (select public.current_company_id()));
create policy catalog_items_insert_own on public.catalog_items
for insert to authenticated with check (company_id = (select public.current_company_id()));
create policy catalog_items_update_own on public.catalog_items
for update to authenticated using (company_id = (select public.current_company_id()))
with check (company_id = (select public.current_company_id()));
create policy catalog_items_delete_own on public.catalog_items
for delete to authenticated using (company_id = (select public.current_company_id()));

create policy invoices_select_own on public.invoices
for select to authenticated using (company_id = (select public.current_company_id()));

create policy invoice_lines_select_own on public.invoice_lines
for select to authenticated using (exists (
  select 1 from public.invoices i
  where i.id = invoice_id and i.company_id = (select public.current_company_id())
));
create policy invoice_lines_insert_draft on public.invoice_lines
for insert to authenticated with check (exists (
  select 1 from public.invoices i
  where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status = 'draft'
));
create policy invoice_lines_update_draft on public.invoice_lines
for update to authenticated using (exists (
  select 1 from public.invoices i
  where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status = 'draft'
)) with check (exists (
  select 1 from public.invoices i
  where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status = 'draft'
));
create policy invoice_lines_delete_draft on public.invoice_lines
for delete to authenticated using (exists (
  select 1 from public.invoices i
  where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status = 'draft'
));

create policy payments_select_own on public.payments
for select to authenticated using (exists (
  select 1 from public.invoices i
  where i.id = invoice_id and i.company_id = (select public.current_company_id())
));
create policy payments_insert_own on public.payments
for insert to authenticated with check (exists (
  select 1 from public.invoices i
  where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status <> 'draft'
));

create policy waitlist_dgi_select_own on public.waitlist_dgi
for select to authenticated using (user_id = auth.uid());
create policy waitlist_dgi_insert_own on public.waitlist_dgi
for insert to authenticated with check (user_id = auth.uid());

create policy settings_select_own on public.settings
for select to authenticated using (company_id = (select public.current_company_id()));
create policy settings_insert_own on public.settings
for insert to authenticated with check (company_id = (select public.current_company_id()));
create policy settings_update_own on public.settings
for update to authenticated using (company_id = (select public.current_company_id()))
with check (company_id = (select public.current_company_id()));

grant usage on schema public to authenticated;
revoke all on table public.companies, public.profiles, public.clients, public.catalog_items,
  public.invoices, public.invoice_lines, public.payments, public.waitlist_dgi, public.settings,
  public.invoice_status_summary from anon, authenticated;
grant select on public.companies, public.profiles, public.clients, public.catalog_items,
  public.invoices, public.invoice_lines, public.payments, public.waitlist_dgi, public.settings,
  public.invoice_status_summary to authenticated;
grant update (company_name, legal_name, sector, served_client_types, vat_status, logo_path, address, phone, rccm, nif)
  on public.companies to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert, update, delete on public.clients, public.catalog_items to authenticated;
grant insert, update, delete on public.invoice_lines to authenticated;
grant insert on public.payments, public.waitlist_dgi, public.settings to authenticated;
grant update (exchange_rate) on public.settings to authenticated;

revoke all on function public.create_invoice_with_lines(uuid, public.invoice_currency, date, date, text, jsonb) from public;
grant execute on function public.create_invoice_with_lines(uuid, public.invoice_currency, date, date, text, jsonb) to authenticated;
revoke all on function public.mark_invoice_sent(uuid) from public;
grant execute on function public.mark_invoice_sent(uuid) to authenticated;

