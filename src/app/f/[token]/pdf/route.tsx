import { renderToBuffer } from "@react-pdf/renderer";
import { notFound } from "next/navigation";
import InvoicePdf from "@/components/invoice-pdf";
import { loadPublicInvoice } from "@/lib/public-invoice";
import { getCompanyLogoUrl } from "@/lib/supabase/storage";

export async function GET(_request: Request, { params }: RouteContext<"/f/[token]/pdf">) {
  const { token } = await params;
  const data = await loadPublicInvoice(token);
  if (!data) notFound();

  const buffer = await renderToBuffer(<InvoicePdf data={data} logoUrl={getCompanyLogoUrl(data.company.logo_path)} />);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Facture-${data.invoice.invoice_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
