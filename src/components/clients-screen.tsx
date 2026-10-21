"use client";

import { useActionState, useState } from "react";
import { createClientAction, type FormActionState } from "@/app/actions/clients-catalog";

type ClientRecord = {
  id: string;
  name: string;
  client_type: "b2b" | "b2a" | "b2c";
  whatsapp_phone: string | null;
  email: string | null;
  address: string | null;
  nif: string | null;
};

const initialState: FormActionState = {};
const typeLabels = { b2b: "Entreprise", b2a: "Administration", b2c: "Particulier" };

export default function ClientsScreen({ clients, loadError, canEdit }: { clients: ClientRecord[]; loadError: boolean; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(createClientAction, initialState);
  const [clientType, setClientType] = useState<ClientRecord["client_type"]>("b2b");

  return (
    <div className="workspace-wrap">
      <h1>Clients</h1>
      <p className="lead">Votre carnet de clients, avec ce qu’ils vous doivent.</p>
      {canEdit && <section className="panel">
        <h2>Ajouter un client</h2>
        <form action={formAction}>
          <div className="grid-two">
            <div><label htmlFor="client-name">Nom du client</label><input id="client-name" name="name" placeholder="Ex. Restaurant Le Palmier" required minLength={2} maxLength={160} /></div>
            <div><label htmlFor="client-kind">Type de client</label><select id="client-kind" name="client_type" value={clientType} onChange={(event) => setClientType(event.target.value as ClientRecord["client_type"])}><option value="b2b">Entreprise</option><option value="b2a">Administration</option><option value="b2c">Particulier</option></select></div>
            <div><label htmlFor="client-phone">Téléphone (WhatsApp)</label><input id="client-phone" name="whatsapp_phone" type="tel" autoComplete="tel" placeholder="+243 …" maxLength={40} /></div>
            <div><label htmlFor="client-email">E-mail</label><input id="client-email" name="email" type="email" autoComplete="email" maxLength={254} /></div>
            <div><label htmlFor="client-address">Adresse</label><input id="client-address" name="address" maxLength={300} /></div>
            <div><label htmlFor="client-nif">NIF{clientType === "b2c" ? " (facultatif)" : " (obligatoire)"}</label><input id="client-nif" name="nif" required={clientType !== "b2c"} maxLength={80} /></div>
          </div>
          {state.error && <p className="auth-error" role="alert">{state.error}</p>}
          {state.success && <p className="message" role="status">{state.success}</p>}
          <div className="inline-action"><button className="button primary" disabled={pending}>{pending ? "Ajout…" : "Ajouter le client"}</button></div>
        </form>
      </section>}
      <section className="panel">
        <h2>Vos clients</h2>
        {loadError && <p className="auth-error" role="alert">Impossible de charger les clients. Vérifiez que les migrations Supabase sont appliquées.</p>}
        {clients.length === 0 ? <p className="empty">Aucun client pour l’instant.{canEdit ? " Ajoutez votre premier client ci-dessus." : ""}</p> : (
          <div className="scroll"><table><thead><tr><th>Nom</th><th>Type</th><th>Téléphone</th><th>E-mail</th><th>NIF</th></tr></thead>
            <tbody>{clients.map((client) => <tr key={client.id}><td>{client.name}</td><td>{typeLabels[client.client_type]}</td><td>{client.whatsapp_phone || "—"}</td><td>{client.email || "—"}</td><td>{client.nif || "—"}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
