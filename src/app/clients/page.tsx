import { Suspense } from "react";
import { connection } from "next/server";
import ClientsScreen from "@/components/clients-screen";
import WorkspaceHeader from "@/components/workspace-header";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

async function ClientsData() {
  await connection();
  const { supabase, user, role } = await requireAuthenticatedCompany();
  const { data, error } = await supabase.from("clients")
    .select("id, name, client_type, whatsapp_phone, email, address, nif")
    .order("name");

  return <><WorkspaceHeader email={user.email ?? ""} role={role} /><ClientsScreen clients={data ?? []} loadError={Boolean(error)} canEdit={["owner", "manager", "collaborator"].includes(role)} /></>;
}

export default function ClientsPage() {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement des clients…</p></main>}><ClientsData /></Suspense>;
}
