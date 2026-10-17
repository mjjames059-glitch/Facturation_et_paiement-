-- Accès public en lecture seule par jeton aléatoire. Les brouillons restent privés.
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
      'address', c.address,
      'phone', c.phone,
      'rccm', c.rccm,
      'nif', c.nif
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
  where i.public_token = p_token
    and length(p_token) = 64
    and p_token ~ '^[a-f0-9]{64}$'
    and i.status <> 'draft'
$$;

revoke all on function public.get_public_invoice(text) from public;
grant execute on function public.get_public_invoice(text) to anon, authenticated;
