-- Add tenant memberships, workspace preferences, subscription plans, and
-- explicit platform administration without rewriting deployed migrations.

create table public.company_memberships (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  role public.company_role not null,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index company_memberships_user_idx on public.company_memberships (user_id, company_id);
alter table public.company_memberships enable row level security;
revoke all on public.company_memberships from anon, authenticated;
grant select on public.company_memberships to authenticated;

insert into public.company_memberships (company_id, user_id, role)
select p.company_id, p.user_id, p.role
from public.profiles p
where p.company_id is not null
on conflict (company_id, user_id) do nothing;

insert into public.company_memberships (company_id, user_id, role)
select c.id, c.owner_id, 'owner'
from public.companies c
where c.owner_id is not null
on conflict (company_id, user_id) do update set role = 'owner';

update public.profiles p
set role = 'owner'
from public.companies c
where c.id = p.company_id
  and c.owner_id = p.user_id
  and p.role <> 'owner';

create policy company_memberships_select_own_or_managed
  on public.company_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      company_id = (select public.current_company_id())
      and (select public.current_company_role()) in ('owner', 'manager')
    )
  );

create or replace function public.ensure_profile_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id is not null then
    insert into public.company_memberships (company_id, user_id, role)
    values (new.company_id, new.user_id, new.role)
    on conflict (company_id, user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.ensure_profile_membership() from public, anon, authenticated;

create trigger profiles_ensure_company_membership
after insert or update on public.profiles
for each row execute function public.ensure_profile_membership();

alter table public.companies
  alter column owner_id drop not null;
alter table public.companies
  drop constraint if exists companies_owner_id_key;
alter table public.companies
  drop constraint if exists companies_owner_id_fkey;
alter table public.companies
  add constraint companies_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete set null;

alter table public.companies
  add column contact_email text
    check (contact_email is null or length(contact_email) <= 254);

alter table public.settings
  add column brand_primary_color text not null default '#2F6B3F'
    check (brand_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column brand_accent_color text not null default '#EAF3E7'
    check (brand_accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column locale text not null default 'fr-CD'
    check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  add column default_currency public.invoice_currency not null default 'USD',
  add column invoice_due_days integer not null default 30
    check (invoice_due_days between 0 and 365),
  add column invoice_footer text
    check (invoice_footer is null or length(invoice_footer) <= 2000);

grant update (contact_email) on public.companies to authenticated;
grant update (brand_primary_color, brand_accent_color, locale, default_currency, invoice_due_days, invoice_footer)
  on public.settings to authenticated;

create table public.subscription_plans (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  name text not null check (length(trim(name)) between 2 and 80),
  description text not null default '' check (length(description) <= 500),
  entitlements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(entitlements) = 'object'),
  max_members integer check (max_members is null or max_members >= 1),
  max_clients integer check (max_clients is null or max_clients >= 0),
  max_catalog_items integer check (max_catalog_items is null or max_catalog_items >= 0),
  max_monthly_invoices integer check (max_monthly_invoices is null or max_monthly_invoices >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plans (id, name, description, entitlements)
values
  (
    'legacy',
    'Compatibilité',
    'Accès conservé pour les entreprises existantes.',
    '{"clients":true,"catalog":true,"invoices":true,"payments":true,"team":true,"catalog_sharing":true,"branding":true}'::jsonb
  ),
  (
    'trial',
    'Essai',
    'Accès d’essai de 30 jours aux fonctionnalités Facturo.',
    '{"clients":true,"catalog":true,"invoices":true,"payments":true,"team":true,"catalog_sharing":true,"branding":true}'::jsonb
  );

alter table public.subscription_plans enable row level security;
revoke all on public.subscription_plans from anon, authenticated;
grant select on public.subscription_plans to authenticated;
create policy subscription_plans_select_active
  on public.subscription_plans
  for select to authenticated using (is_active);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete restrict,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.is_active
  )
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create table public.company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  plan_id text not null references public.subscription_plans (id),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  billing_interval text not null default 'none' check (billing_interval in ('month', 'year', 'none')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  cancel_at_period_end boolean not null default false,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);
create unique index company_subscriptions_provider_customer_idx
  on public.company_subscriptions (provider, provider_customer_id)
  where provider is not null and provider_customer_id is not null;
create unique index company_subscriptions_provider_subscription_idx
  on public.company_subscriptions (provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;
create index company_subscriptions_status_plan_idx on public.company_subscriptions (status, plan_id);
alter table public.company_subscriptions enable row level security;
revoke all on public.company_subscriptions from anon, authenticated;
grant select on public.company_subscriptions to authenticated;

insert into public.company_subscriptions (company_id, plan_id, status, billing_interval, current_period_start)
select c.id, 'legacy', 'active', 'none', c.created_at
from public.companies c
on conflict (company_id) do nothing;

create or replace function public.initialize_company_subscription()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trial_end timestamptz := now() + interval '30 days';
begin
  insert into public.company_subscriptions (
    company_id, plan_id, status, billing_interval,
    current_period_start, current_period_end, trial_ends_at
  )
  values (
    new.id, 'trial', 'trialing', 'none',
    now(), v_trial_end, v_trial_end
  )
  on conflict (company_id) do nothing;
  return new;
end;
$$;
revoke all on function public.initialize_company_subscription() from public, anon, authenticated;
create trigger companies_initialize_subscription
after insert on public.companies
for each row execute function public.initialize_company_subscription();

create policy company_subscriptions_select_company_or_platform_admin
  on public.company_subscriptions
  for select to authenticated
  using (
    company_id = (select public.current_company_id())
    or (select public.is_platform_admin())
  );

create table public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  action text not null check (length(action) between 2 and 100),
  entity_type text not null check (length(entity_type) between 2 and 80),
  entity_id uuid,
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index platform_audit_events_created_at_idx on public.platform_audit_events (created_at desc);
create index platform_audit_events_company_created_idx on public.platform_audit_events (company_id, created_at desc);
alter table public.platform_audit_events enable row level security;
revoke all on public.platform_audit_events from public, anon, authenticated;
grant select on public.platform_audit_events to authenticated;
create policy platform_audit_events_select_admin
  on public.platform_audit_events
  for select to authenticated
  using ((select public.is_platform_admin()));

create or replace function public.audit_support_message_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.platform_audit_events (
    actor_id, company_id, action, entity_type, entity_id, before_data, after_data
  )
  values (
    auth.uid(),
    new.company_id,
    'support_message.status_updated',
    'support_message',
    new.id,
    jsonb_build_object('status', old.status),
    jsonb_build_object('status', new.status)
  );
  return new;
end;
$$;
revoke all on function public.audit_support_message_status() from public, anon, authenticated;
create trigger support_messages_audit_status
after update of status on public.support_messages
for each row
when (old.status is distinct from new.status)
execute function public.audit_support_message_status();

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.company_id
  from public.profiles p
  join public.company_memberships m
    on m.company_id = p.company_id
   and m.user_id = p.user_id
  where p.user_id = auth.uid()
$$;
revoke all on function public.current_company_id() from public;
grant execute on function public.current_company_id() to authenticated;

create or replace function public.current_company_role()
returns public.company_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.company_memberships m
  where m.user_id = auth.uid()
    and m.company_id = (select public.current_company_id())
$$;
revoke all on function public.current_company_role() from public;
grant execute on function public.current_company_role() to authenticated;

drop policy if exists companies_select_own on public.companies;
create policy companies_select_memberships
  on public.companies
  for select to authenticated
  using (exists (
    select 1 from public.company_memberships m
    where m.company_id = id and m.user_id = auth.uid()
  ));

drop policy if exists profiles_select_company on public.profiles;
create policy profiles_select_own_or_company
  on public.profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or company_id = (select public.current_company_id())
  );

create or replace function public.list_my_company_workspaces()
returns table (
  company_id uuid,
  company_name text,
  logo_path text,
  role public.company_role,
  is_current boolean,
  brand_primary_color text,
  brand_accent_color text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.company_name, c.logo_path, m.role, c.id = (select public.current_company_id()),
    coalesce(s.brand_primary_color, '#2F6B3F'),
    coalesce(s.brand_accent_color, '#EAF3E7')
  from public.company_memberships m
  join public.companies c on c.id = m.company_id
  left join public.settings s on s.company_id = c.id
  where m.user_id = auth.uid()
  order by c.company_name, c.id
$$;
revoke all on function public.list_my_company_workspaces() from public, anon;
grant execute on function public.list_my_company_workspaces() to authenticated;

create or replace function public.set_active_company(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.company_memberships m
    where m.company_id = p_company_id and m.user_id = auth.uid()
  ) then
    raise exception 'Entreprise non accessible pour cet utilisateur' using errcode = '42501';
  end if;

  update public.profiles p
  set company_id = p_company_id,
      role = (select m.role from public.company_memberships m
              where m.company_id = p_company_id and m.user_id = auth.uid())
  where p.user_id = auth.uid();
  if not found then
    raise exception 'Profil utilisateur introuvable' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.set_active_company(uuid) from public, anon;
grant execute on function public.set_active_company(uuid) to authenticated;

create or replace function public.current_company_has_entitlement(p_entitlement text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((p.entitlements ->> p_entitlement)::boolean, false)
  from public.company_subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.company_id = (select public.current_company_id())
    and p.is_active
    and (
      s.status = 'active'
      or (s.status = 'trialing' and s.trial_ends_at > now())
    )
$$;
revoke all on function public.current_company_has_entitlement(text) from public, anon;
grant execute on function public.current_company_has_entitlement(text) to authenticated;

create or replace function public.current_company_within_limit(p_limit_key text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.current_company_id();
  v_limit integer;
  v_usage bigint;
begin
  if v_company_id is null or p_limit_key is null
    or p_limit_key not in ('max_members', 'max_clients', 'max_catalog_items', 'max_monthly_invoices') then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text || ':' || p_limit_key, 0));

  select case p_limit_key
    when 'max_members' then p.max_members
    when 'max_clients' then p.max_clients
    when 'max_catalog_items' then p.max_catalog_items
    when 'max_monthly_invoices' then p.max_monthly_invoices
    else null
  end
  into v_limit
  from public.company_subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.company_id = v_company_id
    and p.is_active
    and (
      s.status = 'active'
      or (s.status = 'trialing' and s.trial_ends_at > now())
    );
  if not found then return false; end if;

  if v_limit is null then return true; end if;

  case p_limit_key
    when 'max_members' then
      select count(*) into v_usage
      from public.company_memberships m
      where m.company_id = v_company_id;
      v_usage := v_usage + (
        select count(*) from public.company_invitations i
        where i.company_id = v_company_id
          and i.accepted_at is null
          and i.expires_at > now()
      );
    when 'max_clients' then
      select count(*) into v_usage from public.clients c where c.company_id = v_company_id;
    when 'max_catalog_items' then
      select count(*) into v_usage from public.catalog_items ci where ci.company_id = v_company_id;
    when 'max_monthly_invoices' then
      select count(*) into v_usage
      from public.invoices i
      where i.company_id = v_company_id
        and i.created_at >= date_trunc('month', now());
  end case;

  return v_usage < v_limit;
end;
$$;
revoke all on function public.current_company_within_limit(text) from public, anon;
grant execute on function public.current_company_within_limit(text) to authenticated;

drop policy if exists clients_insert_team on public.clients;
create policy clients_insert_team on public.clients
for insert to authenticated with check (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager', 'collaborator')
  and (select public.current_company_has_entitlement('clients'))
  and (select public.current_company_within_limit('max_clients'))
);
drop policy if exists clients_update_team on public.clients;
create policy clients_update_team on public.clients
for update to authenticated using (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager', 'collaborator')
  and (select public.current_company_has_entitlement('clients'))
) with check (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager', 'collaborator')
  and (select public.current_company_has_entitlement('clients'))
);
drop policy if exists clients_delete_team on public.clients;
create policy clients_delete_team on public.clients
for delete to authenticated using (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('clients'))
);

drop policy if exists catalog_items_insert_team on public.catalog_items;
create policy catalog_items_insert_team on public.catalog_items
for insert to authenticated with check (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager', 'collaborator')
  and (select public.current_company_has_entitlement('catalog'))
  and (select public.current_company_within_limit('max_catalog_items'))
);
drop policy if exists catalog_items_update_team on public.catalog_items;
create policy catalog_items_update_team on public.catalog_items
for update to authenticated using (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager', 'collaborator')
  and (select public.current_company_has_entitlement('catalog'))
) with check (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager', 'collaborator')
  and (select public.current_company_has_entitlement('catalog'))
);
drop policy if exists catalog_items_delete_team on public.catalog_items;
create policy catalog_items_delete_team on public.catalog_items
for delete to authenticated using (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('catalog'))
);

drop policy if exists settings_update_managers on public.settings;
create policy settings_update_managers on public.settings
for update to authenticated using (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('branding'))
) with check (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('branding'))
);
drop policy if exists settings_insert_managers on public.settings;
create policy settings_insert_managers on public.settings
for insert to authenticated with check (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('branding'))
);

drop policy if exists companies_update_managers on public.companies;
create policy companies_update_managers on public.companies
for update to authenticated using (
  id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('branding'))
) with check (
  id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('branding'))
);

drop policy if exists invoice_lines_insert_team on public.invoice_lines;
create policy invoice_lines_insert_team on public.invoice_lines
for insert to authenticated with check (
  (select public.current_company_role()) in ('owner', 'manager', 'accountant', 'collaborator')
  and (select public.current_company_has_entitlement('invoices'))
  and exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status = 'draft'
  )
);
drop policy if exists invoice_lines_update_team on public.invoice_lines;
create policy invoice_lines_update_team on public.invoice_lines
for update to authenticated using (
  (select public.current_company_role()) in ('owner', 'manager', 'accountant', 'collaborator')
  and (select public.current_company_has_entitlement('invoices'))
  and exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status = 'draft'
  )
) with check (
  (select public.current_company_role()) in ('owner', 'manager', 'accountant', 'collaborator')
  and (select public.current_company_has_entitlement('invoices'))
  and exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status = 'draft'
  )
);
drop policy if exists invoice_lines_delete_team on public.invoice_lines;
create policy invoice_lines_delete_team on public.invoice_lines
for delete to authenticated using (
  (select public.current_company_role()) in ('owner', 'manager', 'accountant', 'collaborator')
  and (select public.current_company_has_entitlement('invoices'))
  and exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.company_id = (select public.current_company_id()) and i.status = 'draft'
  )
);

drop policy if exists catalog_shares_insert_managers on public.catalog_shares;
create policy catalog_shares_insert_managers on public.catalog_shares
for insert to authenticated with check (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('catalog_sharing'))
);
drop policy if exists catalog_shares_delete_managers on public.catalog_shares;
create policy catalog_shares_delete_managers on public.catalog_shares
for delete to authenticated using (
  company_id = (select public.current_company_id())
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('catalog_sharing'))
);

drop policy if exists company_logos_insert_managers on storage.objects;
create policy company_logos_insert_managers on storage.objects
for insert to authenticated with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('branding'))
);
drop policy if exists company_logos_update_managers on storage.objects;
create policy company_logos_update_managers on storage.objects
for update to authenticated using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('branding'))
) with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('branding'))
);
drop policy if exists company_logos_delete_managers on storage.objects;
create policy company_logos_delete_managers on storage.objects
for delete to authenticated using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (select public.current_company_role()) in ('owner', 'manager')
  and (select public.current_company_has_entitlement('branding'))
);

create or replace function public.enforce_invoice_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id is distinct from public.current_company_id()
    or not public.current_company_has_entitlement('invoices')
    or not public.current_company_within_limit('max_monthly_invoices') then
    raise exception 'Entitlement facture absent ou limite atteinte' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_invoice_entitlement() from public, anon, authenticated;
create trigger invoices_enforce_entitlement
before insert on public.invoices
for each row execute function public.enforce_invoice_entitlement();

create or replace function public.mark_invoice_sent(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.current_company_id();
begin
  if v_company_id is null
    or (select public.current_company_role()) not in ('owner', 'manager', 'accountant', 'collaborator') then
    raise exception 'Rôle insuffisant pour envoyer une facture' using errcode = '42501';
  end if;
  if not (select public.current_company_has_entitlement('invoices')) then
    raise exception 'Fonction facture non incluse dans l’abonnement' using errcode = '42501';
  end if;
  update public.invoices i
  set status = 'sent', updated_at = now()
  where i.id = p_invoice_id and i.company_id = v_company_id and i.status = 'draft';
  if not found then
    raise exception 'Brouillon introuvable pour cette entreprise' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.mark_invoice_sent(uuid) from public, anon;
grant execute on function public.mark_invoice_sent(uuid) to authenticated;

create or replace function public.enforce_payment_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select i.company_id into v_company_id
  from public.invoices i
  where i.id = new.invoice_id;
  if v_company_id is distinct from public.current_company_id()
    or not public.current_company_has_entitlement('payments') then
    raise exception 'Entitlement paiement absent' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_payment_entitlement() from public, anon, authenticated;
create trigger payments_enforce_entitlement
before insert on public.payments
for each row execute function public.enforce_payment_entitlement();

create or replace function public.create_company_invitation(p_email text, p_role public.company_role)
returns table (invitation_token text, invitation_expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_token text;
  v_expires_at timestamptz;
begin
  if auth.uid() is null or (select public.current_company_role()) not in ('owner', 'manager') then
    raise exception 'Rôle insuffisant pour inviter un membre' using errcode = '42501';
  end if;
  if p_role = 'owner' or p_email is null or length(trim(p_email)) > 254
    or trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail ou rôle invalide' using errcode = '22023';
  end if;
  if (select public.current_company_role()) = 'manager' and p_role = 'manager' then
    raise exception 'Seul le propriétaire peut inviter un gestionnaire' using errcode = '42501';
  end if;
  if not (select public.current_company_has_entitlement('team')) then
    raise exception 'Fonction équipe non incluse dans l’abonnement' using errcode = '42501';
  end if;
  select public.current_company_id() into v_company_id;
  delete from public.company_invitations
  where company_id = v_company_id and email = lower(trim(p_email)) and accepted_at is null;
  if not (select public.current_company_within_limit('max_members')) then
    raise exception 'Limite de membres atteinte' using errcode = '42501';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '48 hours';
  insert into public.company_invitations (company_id, email, role, token_hash, created_by, expires_at)
  values (v_company_id, lower(trim(p_email)), p_role, encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid(), v_expires_at);
  return query select v_token, v_expires_at;
end;
$$;
revoke all on function public.create_company_invitation(text, public.company_role) from public;
grant execute on function public.create_company_invitation(text, public.company_role) to authenticated;

create or replace function public.accept_company_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_invitation_id uuid;
  v_role public.company_role;
  v_member_role public.company_role;
  v_user_email text;
  v_team_enabled boolean;
  v_member_limit integer;
  v_member_usage bigint;
begin
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  select lower(u.email) into v_user_email from auth.users u where u.id = v_user_id;
  select i.id, i.company_id, i.role
    into v_invitation_id, v_company_id, v_role
  from public.company_invitations i
  where p_token ~ '^[a-f0-9]{64}$'
    and i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.email = v_user_email
    and i.accepted_at is null
    and i.expires_at > now()
  for update;
  if v_invitation_id is null then
    raise exception 'Invitation invalide, expirée ou destinée à une autre adresse' using errcode = '42501';
  end if;
  select
    coalesce((sp.entitlements ->> 'team')::boolean, false),
    sp.max_members
  into v_team_enabled, v_member_limit
  from public.company_subscriptions s
  join public.subscription_plans sp on sp.id = s.plan_id
  where s.company_id = v_company_id
    and sp.is_active
    and (
      s.status = 'active'
      or (s.status = 'trialing' and s.trial_ends_at > now())
    );
  if not found or not v_team_enabled then
    raise exception 'Fonction équipe non incluse dans l’abonnement' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text || ':max_members', 0));
  select
    (select count(*) from public.company_memberships m where m.company_id = v_company_id)
    + (select count(*) from public.company_invitations i
       where i.company_id = v_company_id
         and i.accepted_at is null
         and i.expires_at > now())
  into v_member_usage;
  if v_member_limit is not null and v_member_usage > v_member_limit then
    raise exception 'Limite de membres atteinte' using errcode = '42501';
  end if;

  insert into public.company_memberships (company_id, user_id, role)
  values (v_company_id, v_user_id, v_role)
  on conflict (company_id, user_id) do nothing;
  select m.role into v_member_role
  from public.company_memberships m
  where m.company_id = v_company_id and m.user_id = v_user_id;
  update public.company_invitations
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_invitation_id;
  update public.profiles
  set company_id = v_company_id, role = v_member_role
  where user_id = v_user_id;
  return v_company_id;
end;
$$;
revoke all on function public.accept_company_invitation(text) from public, anon;
grant execute on function public.accept_company_invitation(text) to authenticated;

create or replace function public.list_platform_companies(
  p_search text default null,
  p_status text default null,
  p_plan_id text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  company_id uuid,
  company_name text,
  owner_name text,
  owner_email text,
  created_at timestamptz,
  plan_id text,
  plan_name text,
  subscription_status text,
  current_period_end timestamptz,
  member_count bigint,
  client_count bigint,
  invoice_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not (select public.is_platform_admin()) then
    raise exception 'Accès plateforme refusé' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('trialing', 'active', 'past_due', 'canceled', 'incomplete') then
    raise exception 'Filtre d’abonnement invalide' using errcode = '22023';
  end if;
  return query
  select
    c.id,
    c.company_name,
    p.display_name,
    u.email::text,
    c.created_at,
    s.plan_id,
    sp.name,
    s.status,
    s.current_period_end,
    (select count(*) from public.company_memberships m where m.company_id = c.id),
    (select count(*) from public.clients cl where cl.company_id = c.id),
    (select count(*) from public.invoices i where i.company_id = c.id)
  from public.companies c
  left join auth.users u on u.id = c.owner_id
  left join public.profiles p on p.user_id = c.owner_id
  left join public.company_subscriptions s on s.company_id = c.id
  left join public.subscription_plans sp on sp.id = s.plan_id
  where (
    nullif(trim(p_search), '') is null
    or c.company_name ilike '%' || trim(p_search) || '%'
    or coalesce(u.email, '') ilike '%' || trim(p_search) || '%'
  )
    and (p_status is null or s.status = p_status)
    and (p_plan_id is null or s.plan_id = p_plan_id)
  order by c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke all on function public.list_platform_companies(text, text, text, integer, integer) from public, anon;
grant execute on function public.list_platform_companies(text, text, text, integer, integer) to authenticated;

create or replace function public.change_company_subscription(
  p_company_id uuid,
  p_plan_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.company_subscriptions%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if not (select public.is_platform_admin()) then
    raise exception 'Accès plateforme refusé' using errcode = '42501';
  end if;
  if p_status not in ('trialing', 'active', 'past_due', 'canceled', 'incomplete') then
    raise exception 'État d’abonnement invalide' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.subscription_plans p
    where p.id = p_plan_id and p.is_active
  ) then
    raise exception 'Forfait absent ou inactif' using errcode = '22023';
  end if;

  select * into v_subscription
  from public.company_subscriptions s
  where s.company_id = p_company_id
  for update;
  if not found then
    raise exception 'Abonnement introuvable' using errcode = 'P0002';
  end if;
  v_before := jsonb_build_object(
    'plan_id', v_subscription.plan_id,
    'status', v_subscription.status,
    'billing_interval', v_subscription.billing_interval,
    'current_period_end', v_subscription.current_period_end,
    'trial_ends_at', v_subscription.trial_ends_at,
    'canceled_at', v_subscription.canceled_at,
    'cancel_at_period_end', v_subscription.cancel_at_period_end
  );

  update public.company_subscriptions
  set plan_id = p_plan_id,
      status = p_status,
      current_period_start = case
        when p_status = 'trialing' then now()
        else current_period_start
      end,
      current_period_end = case
        when p_status = 'trialing' then now() + interval '30 days'
        else current_period_end
      end,
      trial_ends_at = case
        when p_status = 'trialing' then now() + interval '30 days'
        else null
      end,
      canceled_at = case when p_status = 'canceled' then coalesce(canceled_at, now()) else null end,
      cancel_at_period_end = false,
      updated_at = now()
  where id = v_subscription.id
  returning * into v_subscription;

  v_after := jsonb_build_object(
    'plan_id', v_subscription.plan_id,
    'status', v_subscription.status,
    'billing_interval', v_subscription.billing_interval,
    'current_period_end', v_subscription.current_period_end,
    'trial_ends_at', v_subscription.trial_ends_at,
    'canceled_at', v_subscription.canceled_at,
    'cancel_at_period_end', v_subscription.cancel_at_period_end
  );
  insert into public.platform_audit_events (
    actor_id, company_id, action, entity_type, entity_id, before_data, after_data
  )
  values (
    auth.uid(), p_company_id, 'subscription.updated',
    'company_subscription', v_subscription.id, v_before, v_after
  );
end;
$$;
revoke all on function public.change_company_subscription(uuid, text, text) from public, anon;
grant execute on function public.change_company_subscription(uuid, text, text) to authenticated;

create or replace function public.list_platform_audit_events(p_limit integer default 100)
returns table (
  id uuid,
  actor_id uuid,
  actor_email text,
  company_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not (select public.is_platform_admin()) then
    raise exception 'Accès plateforme refusé' using errcode = '42501';
  end if;
  return query
  select e.id, e.actor_id, u.email::text, e.company_id, e.action,
    e.entity_type, e.entity_id, e.before_data, e.after_data, e.created_at
  from public.platform_audit_events e
  left join auth.users u on u.id = e.actor_id
  order by e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;
revoke all on function public.list_platform_audit_events(integer) from public, anon;
grant execute on function public.list_platform_audit_events(integer) to authenticated;

create or replace function public.get_public_invoice(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'invoice', jsonb_build_object(
      'invoice_number', i.invoice_number,
      'currency', i.currency,
      'issued_at', i.issued_at,
      'due_date', i.due_date,
      'order_reference', i.order_reference,
      'total_amount', i.total_amount::text,
      'effective_status', case
        when i.status = 'paid' then 'paid'
        when i.status = 'sent' and i.due_date < current_date then 'overdue'
        else i.status::text
      end
    ),
    'company', jsonb_build_object(
      'company_name', coalesce(c.legal_name, c.company_name),
      'logo_path', c.logo_path,
      'contact_email', c.contact_email,
      'address', c.address,
      'phone', c.phone,
      'rccm', c.rccm,
      'nif', c.nif,
      'brand_primary_color', coalesce(s.brand_primary_color, '#2F6B3F'),
      'brand_accent_color', coalesce(s.brand_accent_color, '#EAF3E7'),
      'locale', coalesce(s.locale, 'fr-CD'),
      'invoice_footer', s.invoice_footer
    ),
    'client', jsonb_build_object(
      'name', cl.name,
      'address', cl.address,
      'nif', cl.nif
    ),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', il.description,
        'unit', il.unit,
        'quantity', il.quantity::text,
        'unit_price', il.unit_price::text,
        'line_total', il.line_total::text
      ) order by il.created_at, il.id)
      from public.invoice_lines il
      where il.invoice_id = i.id
    ), '[]'::jsonb)
  )
  from public.invoices i
  join public.companies c on c.id = i.company_id
  join public.clients cl on cl.id = i.client_id and cl.company_id = i.company_id
  left join public.settings s on s.company_id = c.id
  where i.public_token = p_token
    and length(p_token) = 64
    and p_token ~ '^[a-f0-9]{64}$'
    and i.status <> 'draft'
$$;
revoke all on function public.get_public_invoice(text) from public;
grant execute on function public.get_public_invoice(text) to anon, authenticated;

create or replace function public.is_facturo_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin()
$$;
revoke all on function public.is_facturo_admin() from public, anon;
grant execute on function public.is_facturo_admin() to authenticated;
