-- Recalcule les deux totaux lorsqu’une ligne de brouillon change de facture.
create or replace function public.refresh_invoice_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_invoice_id uuid;
begin
  if tg_op = 'UPDATE' then
    if old.invoice_id is distinct from new.invoice_id then
      update public.invoices i
      set total_amount = coalesce((select sum(l.line_total) from public.invoice_lines l where l.invoice_id = old.invoice_id), 0),
          updated_at = now()
      where i.id = old.invoice_id;
    end if;
  end if;

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

-- Les paiements passent par la fonction contrôlée et verrouillée afin d’éviter
-- les montants arbitraires et les dépassements du solde restant.
drop policy if exists payments_insert_own on public.payments;
drop policy if exists payments_insert_finance_team on public.payments;
revoke insert on public.payments from public, anon, authenticated;
