-- Jeton aléatoire pour le partage public ultérieur d'une facture envoyée.
alter table public.invoices
  add column public_token text not null default encode(extensions.gen_random_bytes(32), 'hex');

create unique index invoices_public_token_idx on public.invoices (public_token);

-- Enregistre le solde restant comme paiement et passe la facture à payée
-- dans une transaction verrouillée pour éviter les doubles marquages concurrents.
create or replace function public.register_invoice_payment(
  p_invoice_id uuid,
  p_paid_at date,
  p_mode public.payment_mode
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_total bigint;
  v_status public.invoice_state;
  v_paid bigint;
  v_remaining bigint;
begin
  select p.company_id into v_company_id
  from public.profiles p
  where p.user_id = auth.uid();
  if v_company_id is null then
    raise exception 'Profil d’entreprise introuvable' using errcode = '42501';
  end if;

  select i.total_amount, i.status into v_total, v_status
  from public.invoices i
  where i.id = p_invoice_id and i.company_id = v_company_id
  for update;
  if not found or v_status = 'draft' then
    raise exception 'Facture introuvable ou encore en brouillon' using errcode = '42501';
  end if;
  if v_status = 'paid' then
    raise exception 'Cette facture est déjà payée' using errcode = '22023';
  end if;

  select coalesce(sum(p.amount), 0) into v_paid
  from public.payments p
  where p.invoice_id = p_invoice_id;
  v_remaining := v_total - v_paid;
  if v_remaining <= 0 then
    raise exception 'Aucun solde restant à enregistrer' using errcode = '22023';
  end if;

  insert into public.payments (invoice_id, amount, paid_at, mode)
  values (p_invoice_id, v_remaining, p_paid_at, p_mode);
end;
$$;

revoke all on function public.register_invoice_payment(uuid, date, public.payment_mode) from public;
grant execute on function public.register_invoice_payment(uuid, date, public.payment_mode) to authenticated;
