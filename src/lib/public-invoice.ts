import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const publicInvoiceSchema = z.object({
  invoice: z.object({
    invoice_number: z.string(),
    currency: z.enum(["USD", "CDF"]),
    issued_at: z.string(),
    due_date: z.string(),
    order_reference: z.string().nullable(),
    total_amount: z.string(),
    effective_status: z.enum(["sent", "paid", "overdue"]),
  }),
  company: z.object({
    company_name: z.string(),
    logo_path: z.string().nullable(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    rccm: z.string().nullable(),
    nif: z.string().nullable(),
  }),
  client: z.object({
    name: z.string(),
    address: z.string().nullable(),
    nif: z.string().nullable(),
  }),
  lines: z.array(z.object({
    description: z.string(),
    unit: z.string(),
    quantity: z.string(),
    unit_price: z.string(),
    line_total: z.string(),
  })),
});

export type PublicInvoice = z.infer<typeof publicInvoiceSchema>;

export async function loadPublicInvoice(token: string): Promise<PublicInvoice | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_public_invoice", { p_token: token });
    if (error || !data) return null;
    const parsed = publicInvoiceSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
