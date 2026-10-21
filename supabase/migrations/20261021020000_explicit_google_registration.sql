-- Les nouveaux utilisateurs OAuth doivent compléter explicitement leur profil Facturo.
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

    -- OAuth sans inscription explicite : conserver l'identité Auth, sans créer
    -- d'entreprise par défaut. Le callback proposera ensuite le formulaire Facturo.
    if v_company_name is null then
      return new;
    end if;

    v_sector := nullif(trim(new.raw_user_meta_data ->> 'sector'), '');
    v_vat_status := new.raw_user_meta_data ->> 'vat_status';
    v_served_json := new.raw_user_meta_data -> 'served_client_types';

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Création explicite de l'espace depuis un formulaire soumis par un utilisateur connecté.
create or replace function public.complete_oauth_registration(
  p_display_name text,
  p_company_name text,
  p_sector text,
  p_served_client_types public.client_type[],
  p_vat_status text,
  p_join_waitlist boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where user_id = v_user_id) then
    raise exception 'Un profil Facturo existe déjà pour cet utilisateur' using errcode = '23505';
  end if;
  if nullif(trim(p_display_name), '') is null or length(trim(p_display_name)) > 100 then
    raise exception 'Nom personnel invalide' using errcode = '22023';
  end if;
  if nullif(trim(p_company_name), '') is null or length(trim(p_company_name)) > 120 then
    raise exception 'Nom d’entreprise invalide' using errcode = '22023';
  end if;
  if nullif(trim(p_sector), '') is null or length(trim(p_sector)) > 100 then
    raise exception 'Secteur invalide' using errcode = '22023';
  end if;
  if p_vat_status is null or p_vat_status not in ('yes', 'no', 'unknown') then
    raise exception 'Statut TVA invalide' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_served_client_types), 0) = 0 then
    raise exception 'Sélectionnez au moins un type de client' using errcode = '22023';
  end if;

  select id into v_company_id from public.companies where owner_id = v_user_id;
  if v_company_id is null then
    insert into public.companies (owner_id, company_name, legal_name, sector, served_client_types, vat_status)
    values (v_user_id, trim(p_company_name), trim(p_company_name), trim(p_sector), p_served_client_types, p_vat_status)
    returning id into v_company_id;
  else
    update public.companies
    set company_name = trim(p_company_name), legal_name = trim(p_company_name), sector = trim(p_sector),
        served_client_types = p_served_client_types, vat_status = p_vat_status
    where id = v_company_id;
  end if;

  insert into public.profiles (user_id, company_id, display_name)
  values (v_user_id, v_company_id, trim(p_display_name));
  insert into public.settings (company_id, exchange_rate)
  values (v_company_id, 2800)
  on conflict (company_id) do nothing;

  if p_vat_status = 'yes' and coalesce(p_join_waitlist, false) then
    insert into public.waitlist_dgi (user_id) values (v_user_id)
    on conflict (user_id) do nothing;
  end if;

  return v_company_id;
end;
$$;

revoke all on function public.complete_oauth_registration(text, text, text, public.client_type[], text, boolean) from public, anon;
grant execute on function public.complete_oauth_registration(text, text, text, public.client_type[], text, boolean) to authenticated;
