alter table public.subscription_plans
  add column max_daily_invoices integer check (max_daily_invoices is null or max_daily_invoices >= 0);

create policy subscription_plans_select_platform_admin
  on public.subscription_plans
  for select to authenticated
  using ((select public.is_platform_admin()));

alter table public.company_subscriptions
  add column last_payment_at timestamptz,
  add column last_payment_reference text check (
    last_payment_reference is null or length(last_payment_reference) <= 200
  );

create index invoices_company_created_at_idx
  on public.invoices (company_id, created_at desc);

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_status_check;
alter table public.company_subscriptions
  add constraint company_subscriptions_status_check
  check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'suspended'));

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
      (
        s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())
      )
      or (
        s.status = 'trialing'
        and s.trial_ends_at > now()
      )
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
    or p_limit_key not in (
      'max_members', 'max_clients', 'max_catalog_items',
      'max_monthly_invoices', 'max_daily_invoices'
    ) then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text || ':' || p_limit_key, 0));

  select case p_limit_key
    when 'max_members' then p.max_members
    when 'max_clients' then p.max_clients
    when 'max_catalog_items' then p.max_catalog_items
    when 'max_monthly_invoices' then p.max_monthly_invoices
    when 'max_daily_invoices' then p.max_daily_invoices
    else null
  end
  into v_limit
  from public.company_subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.company_id = v_company_id
    and p.is_active
    and (
      (
        s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())
      )
      or (
        s.status = 'trialing'
        and s.trial_ends_at > now()
      )
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
      select count(*) into v_usage
      from public.clients c
      where c.company_id = v_company_id;
    when 'max_catalog_items' then
      select count(*) into v_usage
      from public.catalog_items ci
      where ci.company_id = v_company_id;
    when 'max_monthly_invoices' then
      select count(*) into v_usage
      from public.invoices i
      where i.company_id = v_company_id
        and i.created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
    when 'max_daily_invoices' then
      select count(*) into v_usage
      from public.invoices i
      where i.company_id = v_company_id
        and i.created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  end case;

  return v_usage < v_limit;
end;
$$;
revoke all on function public.current_company_within_limit(text) from public, anon;
grant execute on function public.current_company_within_limit(text) to authenticated;

create or replace function public.enforce_invoice_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id is distinct from public.current_company_id()
    or not public.current_company_has_entitlement('invoices')
    or not public.current_company_within_limit('max_monthly_invoices')
    or not public.current_company_within_limit('max_daily_invoices') then
    raise exception 'Abonnement absent, expiré ou limite de factures atteinte' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_invoice_entitlement() from public, anon, authenticated;

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
      (
        s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())
      )
      or (
        s.status = 'trialing'
        and s.trial_ends_at > now()
      )
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

drop function public.list_platform_companies(text, text, text, integer, integer);
create function public.list_platform_companies(
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
  trial_ends_at timestamptz,
  last_payment_at timestamptz,
  last_payment_reference text,
  max_daily_invoices integer,
  invoices_today bigint,
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
  if p_status is not null and p_status not in (
    'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'suspended'
  ) then
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
    s.trial_ends_at,
    s.last_payment_at,
    s.last_payment_reference,
    sp.max_daily_invoices,
    (
      select count(*) from public.invoices i
      where i.company_id = c.id
        and i.created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    ),
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

drop function public.change_company_subscription(uuid, text, text);
create function public.change_company_subscription(
  p_company_id uuid,
  p_plan_id text,
  p_status text,
  p_current_period_end date default null,
  p_trial_ends_at date default null
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
  v_period_end timestamptz;
  v_trial_end timestamptz;
  v_period_start timestamptz;
begin
  if not (select public.is_platform_admin()) then
    raise exception 'Accès plateforme refusé' using errcode = '42501';
  end if;
  if p_status not in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'suspended') then
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

  v_trial_end := case
    when p_trial_ends_at is null and p_status = 'trialing' then now() + interval '30 days'
    when p_trial_ends_at is null then null
    else ((p_trial_ends_at + 1)::timestamp at time zone 'UTC') - interval '1 second'
  end;
  v_period_end := case
    when p_current_period_end is not null then
      ((p_current_period_end + 1)::timestamp at time zone 'UTC') - interval '1 second'
    when p_status = 'trialing' then v_trial_end
    else null
  end;
  v_period_start := case when p_status = 'trialing' then now() else v_subscription.current_period_start end;
  if v_period_end is not null and v_period_start is not null and v_period_end <= v_period_start then
    raise exception 'La date de fin doit être postérieure au début de la période' using errcode = '22023';
  end if;

  v_before := jsonb_build_object(
    'plan_id', v_subscription.plan_id,
    'status', v_subscription.status,
    'current_period_end', v_subscription.current_period_end,
    'trial_ends_at', v_subscription.trial_ends_at,
    'canceled_at', v_subscription.canceled_at,
    'last_payment_at', v_subscription.last_payment_at,
    'last_payment_reference', v_subscription.last_payment_reference
  );
  update public.company_subscriptions
  set plan_id = p_plan_id,
      status = p_status,
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      trial_ends_at = case when p_status = 'trialing' then v_trial_end else null end,
      canceled_at = case when p_status = 'canceled' then coalesce(canceled_at, now()) else null end,
      cancel_at_period_end = false,
      updated_at = now()
  where id = v_subscription.id
  returning * into v_subscription;

  v_after := jsonb_build_object(
    'plan_id', v_subscription.plan_id,
    'status', v_subscription.status,
    'current_period_end', v_subscription.current_period_end,
    'trial_ends_at', v_subscription.trial_ends_at,
    'canceled_at', v_subscription.canceled_at,
    'last_payment_at', v_subscription.last_payment_at,
    'last_payment_reference', v_subscription.last_payment_reference
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
revoke all on function public.change_company_subscription(uuid, text, text, date, date) from public, anon;
grant execute on function public.change_company_subscription(uuid, text, text, date, date) to authenticated;

create or replace function public.update_subscription_plan_limits(
  p_plan_id text,
  p_max_members integer,
  p_max_clients integer,
  p_max_catalog_items integer,
  p_max_monthly_invoices integer,
  p_max_daily_invoices integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.subscription_plans%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if not (select public.is_platform_admin()) then
    raise exception 'Accès plateforme refusé' using errcode = '42501';
  end if;
  if p_max_members is not null and p_max_members < 1
    or p_max_clients is not null and p_max_clients < 0
    or p_max_catalog_items is not null and p_max_catalog_items < 0
    or p_max_monthly_invoices is not null and p_max_monthly_invoices < 0
    or p_max_daily_invoices is not null and p_max_daily_invoices < 0 then
    raise exception 'Les limites du forfait sont invalides' using errcode = '22023';
  end if;

  select * into v_plan
  from public.subscription_plans
  where id = p_plan_id
  for update;
  if not found then
    raise exception 'Forfait introuvable' using errcode = 'P0002';
  end if;
  v_before := jsonb_build_object(
    'max_members', v_plan.max_members,
    'max_clients', v_plan.max_clients,
    'max_catalog_items', v_plan.max_catalog_items,
    'max_monthly_invoices', v_plan.max_monthly_invoices,
    'max_daily_invoices', v_plan.max_daily_invoices
  );
  update public.subscription_plans
  set max_members = p_max_members,
      max_clients = p_max_clients,
      max_catalog_items = p_max_catalog_items,
      max_monthly_invoices = p_max_monthly_invoices,
      max_daily_invoices = p_max_daily_invoices,
      updated_at = now()
  where id = p_plan_id
  returning * into v_plan;
  v_after := jsonb_build_object(
    'max_members', v_plan.max_members,
    'max_clients', v_plan.max_clients,
    'max_catalog_items', v_plan.max_catalog_items,
    'max_monthly_invoices', v_plan.max_monthly_invoices,
    'max_daily_invoices', v_plan.max_daily_invoices
  );
  insert into public.platform_audit_events (
    actor_id, action, entity_type, before_data, after_data
  )
  values (
    auth.uid(), 'subscription_plan.limits_updated',
    'subscription_plan', v_before, v_after || jsonb_build_object('plan_id', v_plan.id)
  );
end;
$$;
revoke all on function public.update_subscription_plan_limits(text, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.update_subscription_plan_limits(text, integer, integer, integer, integer, integer) to authenticated;

create or replace function public.record_subscription_payment(
  p_company_id uuid,
  p_paid_at date,
  p_paid_through date,
  p_reference text default null
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
  v_paid_at timestamptz;
  v_paid_through timestamptz;
begin
  if not (select public.is_platform_admin()) then
    raise exception 'Accès plateforme refusé' using errcode = '42501';
  end if;
  if p_paid_at is null or p_paid_through is null or p_paid_through <= p_paid_at
    or length(coalesce(p_reference, '')) > 200 then
    raise exception 'Les informations du paiement sont invalides' using errcode = '22023';
  end if;

  select * into v_subscription
  from public.company_subscriptions s
  where s.company_id = p_company_id
  for update;
  if not found then
    raise exception 'Abonnement introuvable' using errcode = 'P0002';
  end if;
  v_paid_at := p_paid_at::timestamp at time zone 'UTC';
  v_paid_through := ((p_paid_through + 1)::timestamp at time zone 'UTC') - interval '1 second';
  v_before := jsonb_build_object(
    'status', v_subscription.status,
    'current_period_start', v_subscription.current_period_start,
    'current_period_end', v_subscription.current_period_end,
    'last_payment_at', v_subscription.last_payment_at,
    'last_payment_reference', v_subscription.last_payment_reference
  );
  update public.company_subscriptions
  set status = case when status = 'suspended' then 'suspended' else 'active' end,
      current_period_start = v_paid_at,
      current_period_end = v_paid_through,
      trial_ends_at = null,
      canceled_at = null,
      cancel_at_period_end = false,
      last_payment_at = v_paid_at,
      last_payment_reference = nullif(trim(p_reference), ''),
      updated_at = now()
  where id = v_subscription.id
  returning * into v_subscription;
  v_after := jsonb_build_object(
    'status', v_subscription.status,
    'current_period_start', v_subscription.current_period_start,
    'current_period_end', v_subscription.current_period_end,
    'last_payment_at', v_subscription.last_payment_at,
    'last_payment_reference', v_subscription.last_payment_reference
  );
  insert into public.platform_audit_events (
    actor_id, company_id, action, entity_type, entity_id, before_data, after_data
  )
  values (
    auth.uid(), p_company_id, 'subscription.payment_recorded',
    'company_subscription', v_subscription.id,
    v_before, v_after
  );
end;
$$;
revoke all on function public.record_subscription_payment(uuid, date, date, text) from public, anon;
grant execute on function public.record_subscription_payment(uuid, date, date, text) to authenticated;
