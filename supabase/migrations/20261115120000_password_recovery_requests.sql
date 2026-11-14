create table public.password_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  request_day date not null default (now() at time zone 'utc')::date,
  request_count integer not null check (request_count between 1 and 3),
  status text not null default 'email_sent'
    check (status in ('email_sent', 'pending_admin', 'generating', 'link_issued')),
  requested_at timestamptz not null default now(),
  issued_at timestamptz,
  issued_by uuid references auth.users (id) on delete set null
);

create unique index password_recovery_requests_email_idx
  on public.password_recovery_requests (lower(email));
create index password_recovery_requests_admin_queue_idx
  on public.password_recovery_requests (requested_at desc)
  where status = 'pending_admin';

alter table public.password_recovery_requests enable row level security;
revoke all on public.password_recovery_requests from public, anon, authenticated;
grant select on public.password_recovery_requests to authenticated;

create policy password_recovery_requests_select_admin
  on public.password_recovery_requests
  for select to authenticated
  using (status = 'pending_admin' and (select public.is_platform_admin()));

create or replace function public.register_password_recovery_request(p_email text)
returns table (request_allowed boolean, admin_required boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_request_day date := (now() at time zone 'utc')::date;
  v_existing_day date;
  v_request_count integer;
  v_status text;
begin
  if length(v_email) < 3 or length(v_email) > 254 then
    return query select false, false;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));

  select r.request_day, r.request_count, r.status
    into v_existing_day, v_request_count, v_status
    from public.password_recovery_requests r
    where lower(r.email) = v_email
    for update;

  if not found then
    insert into public.password_recovery_requests (email, request_day, request_count)
      values (v_email, v_request_day, 1);
    return query select true, false;
    return;
  end if;

  if v_existing_day < v_request_day then
    update public.password_recovery_requests r
      set request_day = v_request_day,
          request_count = 1,
          status = case when v_status in ('pending_admin', 'generating') then v_status else 'email_sent' end,
          requested_at = now()
      where lower(r.email) = v_email;
    return query select true, false;
    return;
  end if;

  if v_request_count < 2 then
    update public.password_recovery_requests r
      set request_count = v_request_count + 1,
          status = case when v_status in ('pending_admin', 'generating') then v_status else 'email_sent' end,
          requested_at = now()
      where lower(r.email) = v_email;
    return query select true, false;
    return;
  end if;

  update public.password_recovery_requests r
    set request_count = 3,
        status = case
          when v_status = 'generating' then 'generating'
          when exists (select 1 from auth.users u where lower(u.email) = v_email) then 'pending_admin'
          else 'email_sent'
        end,
        requested_at = now()
    where lower(r.email) = v_email;

  return query select false, true;
end;
$$;
revoke all on function public.register_password_recovery_request(text) from public;
grant execute on function public.register_password_recovery_request(text) to anon, authenticated;

create or replace function public.claim_password_recovery_request(p_request_id uuid)
returns table (request_id uuid, email text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (select public.is_platform_admin()) then
    raise exception 'Platform administrator authorization required' using errcode = '42501';
  end if;

  return query
    update public.password_recovery_requests r
      set status = 'generating'
      where r.id = p_request_id and r.status = 'pending_admin'
      returning r.id, r.email;
end;
$$;
revoke all on function public.claim_password_recovery_request(uuid) from public, anon;
grant execute on function public.claim_password_recovery_request(uuid) to authenticated;

create or replace function public.release_password_recovery_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (select public.is_platform_admin()) then
    raise exception 'Platform administrator authorization required' using errcode = '42501';
  end if;

  update public.password_recovery_requests
    set status = 'pending_admin'
    where id = p_request_id and status = 'generating';
end;
$$;
revoke all on function public.release_password_recovery_request(uuid) from public, anon;
grant execute on function public.release_password_recovery_request(uuid) to authenticated;

create or replace function public.finish_password_recovery_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (select public.is_platform_admin()) then
    raise exception 'Platform administrator authorization required' using errcode = '42501';
  end if;

  update public.password_recovery_requests
    set status = 'link_issued',
        issued_at = now(),
        issued_by = auth.uid()
    where id = p_request_id and status = 'generating';

  if not found then
    raise exception 'Password recovery request is no longer being generated';
  end if;
end;
$$;
revoke all on function public.finish_password_recovery_request(uuid) from public, anon;
grant execute on function public.finish_password_recovery_request(uuid) to authenticated;
