-- Gestion d'équipe Facturo inspirée des profils et invitations de Demo_SGS.
-- Les données métier restent dans l'entreprise et continuent d'être protégées par RLS.

create type public.company_role as enum ('owner', 'manager', 'accountant', 'collaborator', 'viewer');

alter table public.profiles drop constraint if exists profiles_company_id_key;
alter table public.profiles add column role public.company_role not null default 'owner';
alter table public.profiles add column phone text;
alter table public.profiles add constraint profiles_phone_length check (phone is null or length(phone) <= 40);
grant update (phone) on public.profiles to authenticated;

create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  role public.company_role not null check (role <> 'owner'),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  check (expires_at > created_at)
);

create index company_invitations_company_idx on public.company_invitations (company_id, created_at desc);
create index company_invitations_pending_email_idx on public.company_invitations (company_id, email) where accepted_at is null;

alter table public.company_invitations enable row level security;

create or replace function public.current_company_role()
returns public.company_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role from public.profiles p where p.user_id = auth.uid()
$$;
revoke all on function public.current_company_role() from public;
grant execute on function public.current_company_role() to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_company on public.profiles
for select to authenticated using (company_id = (select public.current_company_id()));

drop policy if exists companies_update_own on public.companies;
create policy companies_update_managers on public.companies
for update to authenticated
using (id = (select public.current_company_id()) and (select public.current_company_role()) in ('owner', 'manager'))
with check (id = (select public.current_company_id()) and (select public.current_company_role()) in ('owner', 'manager'));

drop policy if exists clients_insert_own on public.clients;
create policy clients_insert_team on public.clients
for insert to authenticated with check (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager', 'collaborator')
);
drop policy if exists clients_update_own on public.clients;
create policy clients_update_team on public.clients
for update to authenticated using (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager', 'collaborator')
) with check (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager', 'collaborator')
);
drop policy if exists clients_delete_own on public.clients;
create policy clients_delete_team on public.clients
for delete to authenticated using (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager')
);

drop policy if exists catalog_items_insert_own on public.catalog_items;
create policy catalog_items_insert_team on public.catalog_items
for insert to authenticated with check (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager', 'collaborator')
);
drop policy if exists catalog_items_update_own on public.catalog_items;
create policy catalog_items_update_team on public.catalog_items
for update to authenticated using (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager', 'collaborator')
) with check (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager', 'collaborator')
);
drop policy if exists catalog_items_delete_own on public.catalog_items;
create policy catalog_items_delete_team on public.catalog_items
for delete to authenticated using (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager')
);

drop policy if exists invoice_lines_insert_draft on public.invoice_lines;
create policy invoice_lines_insert_team on public.invoice_lines
for insert to authenticated with check (
  (select public.current_company_role()) in ('owner', 'manager', 'accountant', 'collaborator')
  and exists (select 1 from public.invoices i where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status = 'draft')
);
drop policy if exists invoice_lines_update_draft on public.invoice_lines;
create policy invoice_lines_update_team on public.invoice_lines
for update to authenticated using (
  (select public.current_company_role()) in ('owner', 'manager', 'accountant', 'collaborator')
  and exists (select 1 from public.invoices i where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status = 'draft')
) with check (
  (select public.current_company_role()) in ('owner', 'manager', 'accountant', 'collaborator')
  and exists (select 1 from public.invoices i where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status = 'draft')
);
drop policy if exists invoice_lines_delete_draft on public.invoice_lines;
create policy invoice_lines_delete_team on public.invoice_lines
for delete to authenticated using (
  (select public.current_company_role()) in ('owner', 'manager', 'accountant', 'collaborator')
  and exists (select 1 from public.invoices i where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status = 'draft')
);

drop policy if exists payments_insert_own on public.payments;
create policy payments_insert_finance_team on public.payments
for insert to authenticated with check (
  (select public.current_company_role()) in ('owner', 'manager', 'accountant')
  and exists (select 1 from public.invoices i where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status <> 'draft')
);

drop policy if exists settings_insert_own on public.settings;
create policy settings_insert_managers on public.settings
for insert to authenticated with check (
  company_id = (select public.current_company_id()) and (select public.current_company_role()) in ('owner', 'manager')
);
drop policy if exists settings_update_own on public.settings;
create policy settings_update_managers on public.settings
for update to authenticated using (
  company_id = (select public.current_company_id()) and (select public.current_company_role()) in ('owner', 'manager')
) with check (
  company_id = (select public.current_company_id()) and (select public.current_company_role()) in ('owner', 'manager')
);

drop policy if exists catalog_shares_insert_own on public.catalog_shares;
create policy catalog_shares_insert_managers on public.catalog_shares
for insert to authenticated with check (
  company_id = (select public.current_company_id()) and (select public.current_company_role()) in ('owner', 'manager')
);
drop policy if exists catalog_shares_delete_own on public.catalog_shares;
create policy catalog_shares_delete_managers on public.catalog_shares
for delete to authenticated using (
  company_id = (select public.current_company_id()) and (select public.current_company_role()) in ('owner', 'manager')
);

drop policy if exists company_logos_insert_own on storage.objects;
create policy company_logos_insert_managers on storage.objects
for insert to authenticated with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (select public.current_company_role()) in ('owner', 'manager')
);
drop policy if exists company_logos_update_own on storage.objects;
create policy company_logos_update_managers on storage.objects
for update to authenticated using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (select public.current_company_role()) in ('owner', 'manager')
) with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (select public.current_company_role()) in ('owner', 'manager')
);
drop policy if exists company_logos_delete_own on storage.objects;
create policy company_logos_delete_managers on storage.objects
for delete to authenticated using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (select public.current_company_role()) in ('owner', 'manager')
);

create policy company_invitations_select_managers on public.company_invitations
for select to authenticated using (
  company_id = (select public.current_company_id()) and (select public.current_company_role()) in ('owner', 'manager')
);
create policy company_invitations_delete_managers on public.company_invitations
for delete to authenticated using (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager')
  and ((select public.current_company_role()) = 'owner' or role <> 'manager')
);

revoke all on public.company_invitations from anon, authenticated;
grant select (id, company_id, email, role, created_by, created_at, expires_at, accepted_at, accepted_by), delete on public.company_invitations to authenticated;

create or replace function public.create_company_invitation(p_email text, p_role public.company_role)
returns table (invitation_token text, invitation_expires_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_token text;
  v_expires_at timestamptz;
begin
  if auth.uid() is null or (select public.current_company_role()) not in ('owner', 'manager') then
    raise exception 'Rôle insuffisant pour inviter un membre' using errcode = '42501';
  end if;
  if p_role = 'owner' or p_email is null or length(trim(p_email)) > 254 or trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail ou rôle invalide' using errcode = '22023';
  end if;
  if (select public.current_company_role()) = 'manager' and p_role = 'manager' then
    raise exception 'Seul le propriétaire peut inviter un gestionnaire' using errcode = '42501';
  end if;
  select public.current_company_id() into v_company_id;
  delete from public.company_invitations
  where company_id = v_company_id and email = lower(trim(p_email)) and accepted_at is null;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '48 hours';
  insert into public.company_invitations (company_id, email, role, token_hash, created_by, expires_at)
  values (v_company_id, lower(trim(p_email)), p_role, encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid(), v_expires_at);
  return query select v_token, v_expires_at;
end;
$$;
revoke all on function public.create_company_invitation(text, public.company_role) from public;
grant execute on function public.create_company_invitation(text, public.company_role) to authenticated;

create or replace function public.lookup_company_invitation(p_token text)
returns table (company_name text, invited_email text, invited_role public.company_role)
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.company_name, i.email, i.role
  from public.company_invitations i
  join public.companies c on c.id = i.company_id
  where p_token ~ '^[a-f0-9]{64}$'
    and i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.accepted_at is null
    and i.expires_at > now()
$$;
revoke all on function public.lookup_company_invitation(text) from public;
grant execute on function public.lookup_company_invitation(text) to anon, authenticated;

-- Une invitation est consommée dans la même transaction que la création du profil.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_company_name text;
  v_sector text;
  v_vat_status text;
  v_served_json jsonb;
  v_served_types public.client_type[] := '{}';
  v_type_text text;
  v_company_id uuid;
  v_role public.company_role := 'owner';
  v_invite_token text;
  v_invitation_id uuid;
begin
  v_invite_token := new.raw_user_meta_data ->> 'company_invite_token';

  if v_invite_token is not null then
    select i.id, i.company_id, i.role into v_invitation_id, v_company_id, v_role
    from public.company_invitations i
    where i.token_hash = encode(extensions.digest(v_invite_token, 'sha256'), 'hex')
      and i.email = lower(trim(new.email))
      and i.accepted_at is null
      and i.expires_at > now()
    for update;

    if v_invitation_id is null then
      raise exception 'Invitation invalide ou expirée' using errcode = '22023';
    end if;

    update public.company_invitations
    set accepted_at = now(), accepted_by = new.id
    where id = v_invitation_id;
  else
    v_company_name := nullif(trim(new.raw_user_meta_data ->> 'company_name'), '');
    v_sector := nullif(trim(new.raw_user_meta_data ->> 'sector'), '');
    v_vat_status := new.raw_user_meta_data ->> 'vat_status';
    v_served_json := new.raw_user_meta_data -> 'served_client_types';

    if v_company_name is null then v_company_name := 'Mon entreprise'; end if;
    if v_sector is null then v_sector := 'Autre'; end if;
    if v_vat_status not in ('yes', 'no', 'unknown') or v_vat_status is null then v_vat_status := 'unknown'; end if;

    if jsonb_typeof(v_served_json) = 'array' then
      for v_type_text in select jsonb_array_elements_text(v_served_json) loop
        if v_type_text in ('b2b', 'b2a', 'b2c') and not (v_type_text::public.client_type = any(v_served_types)) then
          v_served_types := array_append(v_served_types, v_type_text::public.client_type);
        end if;
      end loop;
    end if;
    if cardinality(v_served_types) = 0 then v_served_types := array['b2b', 'b2a', 'b2c']::public.client_type[]; end if;

    insert into public.companies (owner_id, company_name, legal_name, sector, served_client_types, vat_status)
    values (new.id, v_company_name, v_company_name, v_sector, v_served_types, v_vat_status)
    returning id into v_company_id;

    if v_vat_status = 'yes' and new.raw_user_meta_data ->> 'join_waitlist' = 'true' then
      insert into public.waitlist_dgi (user_id) values (new.id) on conflict (user_id) do nothing;
    end if;
  end if;

  insert into public.profiles (user_id, company_id, display_name, role)
  values (
    new.id,
    v_company_id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')),
    v_role
  );

  if v_invitation_id is null then
    insert into public.settings (company_id, exchange_rate) values (v_company_id, 2800);
  end if;

  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

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
  select p.company_id into v_company_id from public.profiles p where p.user_id = auth.uid();
  if v_company_id is null or (select public.current_company_role()) not in ('owner', 'manager', 'accountant', 'collaborator') then
    raise exception 'Rôle insuffisant pour créer une facture' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La facture doit contenir au moins une ligne' using errcode = '22023';
  end if;
  select c.client_type into v_client_type from public.clients c where c.id = p_client_id and c.company_id = v_company_id;
  if v_client_type is null then raise exception 'Client introuvable pour cette entreprise' using errcode = '23503'; end if;
  if v_client_type <> 'b2a' and nullif(trim(p_order_reference), '') is not null then
    raise exception 'La référence de marché est réservée aux administrations' using errcode = '22023';
  end if;
  update public.companies c set next_invoice_number = c.next_invoice_number + 1, updated_at = now()
  where c.id = v_company_id returning c.next_invoice_number - 1 into v_number;
  insert into public.invoices (company_id, client_id, invoice_number, currency, issued_at, due_date, order_reference)
  values (v_company_id, p_client_id, 'F-' || case when length(v_number::text) < 4 then lpad(v_number::text, 4, '0') else v_number::text end,
    p_currency, p_issued_at, p_due_date, nullif(trim(p_order_reference), '')) returning id into v_invoice_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_description := nullif(trim(v_line ->> 'description'), '');
    v_unit := coalesce(nullif(trim(v_line ->> 'unit'), ''), 'unité');
    v_quantity := (v_line ->> 'quantity')::numeric(14, 3);
    v_unit_price := (v_line ->> 'unit_price')::bigint;
    v_catalog_item_id := nullif(v_line ->> 'catalog_item_id', '')::uuid;
    if v_description is null or v_quantity <= 0 or v_unit_price < 0 then raise exception 'Ligne de facture invalide' using errcode = '22023'; end if;
    if v_catalog_item_id is not null and not exists (
      select 1 from public.catalog_items ci where ci.id = v_catalog_item_id and ci.company_id = v_company_id and ci.currency = p_currency
    ) then raise exception 'Article du catalogue introuvable ou dans une autre devise' using errcode = '23503'; end if;
    insert into public.invoice_lines (invoice_id, catalog_item_id, description, unit, quantity, unit_price)
    values (v_invoice_id, v_catalog_item_id, v_description, v_unit, v_quantity, v_unit_price);
  end loop;
  return v_invoice_id;
end;
$$;

create or replace function public.mark_invoice_sent(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  if (select public.current_company_role()) not in ('owner', 'manager', 'accountant', 'collaborator') then
    raise exception 'Rôle insuffisant pour envoyer une facture' using errcode = '42501';
  end if;
  select p.company_id into v_company_id from public.profiles p where p.user_id = auth.uid();
  update public.invoices i set status = 'sent', updated_at = now()
  where i.id = p_invoice_id and i.company_id = v_company_id and i.status = 'draft';
  if not found then raise exception 'Brouillon introuvable pour cette entreprise' using errcode = '42501'; end if;
end;
$$;

create or replace function public.register_invoice_payment(p_invoice_id uuid, p_paid_at date, p_mode public.payment_mode)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_total bigint;
  v_status public.invoice_state;
  v_paid bigint;
  v_remaining bigint;
begin
  if (select public.current_company_role()) not in ('owner', 'manager', 'accountant') then
    raise exception 'Rôle insuffisant pour enregistrer un paiement' using errcode = '42501';
  end if;
  select p.company_id into v_company_id from public.profiles p where p.user_id = auth.uid();
  if v_company_id is null then raise exception 'Profil d’entreprise introuvable' using errcode = '42501'; end if;
  select i.total_amount, i.status into v_total, v_status from public.invoices i
  where i.id = p_invoice_id and i.company_id = v_company_id for update;
  if not found or v_status = 'draft' then raise exception 'Facture introuvable ou encore en brouillon' using errcode = '42501'; end if;
  if v_status = 'paid' then raise exception 'Cette facture est déjà payée' using errcode = '22023'; end if;
  select coalesce(sum(p.amount), 0) into v_paid from public.payments p where p.invoice_id = p_invoice_id;
  v_remaining := v_total - v_paid;
  if v_remaining <= 0 then raise exception 'Aucun solde restant à enregistrer' using errcode = '22023'; end if;
  insert into public.payments (invoice_id, amount, paid_at, mode) values (p_invoice_id, v_remaining, p_paid_at, p_mode);
end;
$$;

revoke all on function public.create_invoice_with_lines(uuid, public.invoice_currency, date, date, text, jsonb) from public;
grant execute on function public.create_invoice_with_lines(uuid, public.invoice_currency, date, date, text, jsonb) to authenticated;
revoke all on function public.mark_invoice_sent(uuid) from public;
grant execute on function public.mark_invoice_sent(uuid) to authenticated;
revoke all on function public.register_invoice_payment(uuid, date, public.payment_mode) from public;
grant execute on function public.register_invoice_payment(uuid, date, public.payment_mode) to authenticated;
