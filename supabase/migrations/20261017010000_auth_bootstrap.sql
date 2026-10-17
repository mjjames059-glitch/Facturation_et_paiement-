-- Crée une entreprise, un profil et les paramètres à l'inscription e-mail.
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
begin
  v_company_name := nullif(trim(new.raw_user_meta_data ->> 'company_name'), '');
  v_sector := nullif(trim(new.raw_user_meta_data ->> 'sector'), '');
  v_vat_status := new.raw_user_meta_data ->> 'vat_status';
  v_served_json := new.raw_user_meta_data -> 'served_client_types';

  if v_company_name is null then
    v_company_name := 'Mon entreprise';
  end if;
  if v_sector is null then
    v_sector := 'Autre';
  end if;
  if v_vat_status not in ('yes', 'no', 'unknown') or v_vat_status is null then
    v_vat_status := 'unknown';
  end if;

  if jsonb_typeof(v_served_json) = 'array' then
    for v_type_text in select jsonb_array_elements_text(v_served_json)
    loop
      if v_type_text in ('b2b', 'b2a', 'b2c') then
        if not (v_type_text::public.client_type = any(v_served_types)) then
          v_served_types := array_append(v_served_types, v_type_text::public.client_type);
        end if;
      end if;
    end loop;
  end if;
  if cardinality(v_served_types) = 0 then
    v_served_types := array['b2b', 'b2a', 'b2c']::public.client_type[];
  end if;

  insert into public.companies (owner_id, company_name, legal_name, sector, served_client_types, vat_status)
  values (new.id, v_company_name, v_company_name, v_sector, v_served_types, v_vat_status)
  returning id into v_company_id;

  insert into public.profiles (user_id, company_id, display_name)
  values (new.id, v_company_id, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''));

  insert into public.settings (company_id, exchange_rate)
  values (v_company_id, 2800);

  if v_vat_status = 'yes' and new.raw_user_meta_data ->> 'join_waitlist' = 'true' then
    insert into public.waitlist_dgi (user_id) values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop policy if exists waitlist_dgi_insert_own on public.waitlist_dgi;
create policy waitlist_dgi_insert_own on public.waitlist_dgi
for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.companies c
    where c.id = (select public.current_company_id()) and c.vat_status = 'yes'
  )
);
