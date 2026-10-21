import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMinorAmount } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function SharedCatalogPage({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_shared_catalog", { p_token: token });
  if (error || !data?.length) notFound();
  const companyName = data[0].company_name;
  return <main className="public-shell"><section className="public-invoice"><p className="eyebrow">Catalogue partagé</p><h1>{companyName}</h1><p className="lead">Produits et services disponibles</p><div className="scroll"><table><thead><tr><th>Article</th><th>Unité</th><th className="right">Prix</th></tr></thead><tbody>{data.map((item, index) => <tr key={`${item.name}-${index}`}><td>{item.name}</td><td>{item.unit}</td><td className="right">{formatMinorAmount(item.price_amount, item.currency)}</td></tr>)}</tbody></table></div></section></main>;
}
