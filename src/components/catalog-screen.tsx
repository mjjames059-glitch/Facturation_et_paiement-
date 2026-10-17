"use client";

import { useActionState } from "react";
import { archiveCatalogItemAction, createCatalogItemAction, type FormActionState } from "@/app/actions/clients-catalog";
import { formatMinorAmount } from "@/lib/money";

type CatalogRecord = {
  id: string;
  name: string;
  price_amount: string | number;
  currency: "USD" | "CDF";
  unit: string;
  is_active: boolean;
};

const initialState: FormActionState = {};

export default function CatalogScreen({ items, loadError }: { items: CatalogRecord[]; loadError: boolean }) {
  const [state, formAction, pending] = useActionState(createCatalogItemAction, initialState);

  return (
    <div className="workspace-wrap">
      <h1>Catalogue</h1>
      <p className="lead">Retrouvez vos produits et services pour les ajouter rapidement à une facture.</p>
      <section className="panel">
        <h2>Ajouter un produit ou service</h2>
        <form action={formAction}>
          <div className="grid-two">
            <div><label htmlFor="item-name">Nom</label><input id="item-name" name="name" placeholder="Ex. Consultation (1 h)" required minLength={2} maxLength={160} /></div>
            <div><label htmlFor="item-price">Prix</label><input id="item-price" name="price" inputMode="decimal" placeholder="Ex. 40,00" required /></div>
            <div><label htmlFor="item-currency">Devise</label><select id="item-currency" name="currency" defaultValue="USD"><option value="USD">Dollar (USD)</option><option value="CDF">Franc congolais (CDF)</option></select></div>
            <div><label htmlFor="item-unit">Unité</label><input id="item-unit" name="unit" placeholder="Ex. heure, pièce, mois" required maxLength={40} /></div>
          </div>
          <p className="note">Les prix USD sont enregistrés en centimes ; les prix CDF en unités entières.</p>
          {state.error && <p className="auth-error" role="alert">{state.error}</p>}
          {state.success && <p className="message" role="status">{state.success}</p>}
          <div className="inline-action"><button className="button primary" disabled={pending}>{pending ? "Ajout…" : "Ajouter au catalogue"}</button></div>
        </form>
      </section>
      <section className="panel">
        <h2>Produits et services</h2>
        {loadError && <p className="auth-error" role="alert">Impossible de charger le catalogue. Vérifiez que les migrations Supabase sont appliquées.</p>}
        {items.length === 0 ? <p className="empty">Votre catalogue est vide pour le moment.</p> : (
          <div className="scroll"><table><thead><tr><th>Nom</th><th>Unité</th><th>Devise</th><th className="right">Prix</th><th>État</th><th /></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.unit}</td><td>{item.currency}</td><td className="right">{formatMinorAmount(item.price_amount, item.currency)}</td><td>{item.is_active ? "Actif" : "Archivé"}</td><td>{item.is_active && <form action={archiveCatalogItemAction}><input type="hidden" name="id" value={item.id} /><button className="button small" type="submit">Archiver</button></form>}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
