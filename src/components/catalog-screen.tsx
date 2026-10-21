"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  archiveCatalogItemAction,
  createCatalogItemAction,
  disableCatalogSharingAction,
  enableCatalogSharingAction,
  type FormActionState,
} from "@/app/actions/clients-catalog";
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

export default function CatalogScreen({ items, loadError, shareToken }: { items: CatalogRecord[]; loadError: boolean; shareToken: string | null }) {
  const [state, formAction, pending] = useActionState(createCatalogItemAction, initialState);
  const [shareState, shareAction, sharing] = useActionState(enableCatalogSharingAction, initialState);
  const [revokeState, revokeAction, revoking] = useActionState(disableCatalogSharingAction, initialState);
  const [copied, setCopied] = useState(false);
  const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/c/${shareToken}` : "";

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }

  function shareOnWhatsApp() {
    if (shareUrl) window.open(`https://wa.me/?text=${encodeURIComponent(`Découvrez notre catalogue : ${shareUrl}`)}`, "_blank", "noopener,noreferrer");
  }

  function shareItemOnWhatsApp(itemName: string) {
    if (shareUrl) window.open(`https://wa.me/?text=${encodeURIComponent(`Découvrez ${itemName} dans notre catalogue : ${shareUrl}`)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="workspace-wrap">
      <h1>Catalogue</h1>
      <p className="lead">Retrouvez vos produits et services pour les ajouter rapidement à une facture.</p>
      <section className="panel">
        <div className="section-title-row"><h2>Ajouter un produit ou service</h2></div>
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
        <div className="section-title-row"><h2>Produits et services</h2>
          <div className="catalog-share-control">
            {shareToken ? <div className="share-actions">
              <Link className="button small" href={`/c/${shareToken}`} target="_blank">Voir le catalogue</Link>
              <button className="button small ok" type="button" onClick={shareOnWhatsApp}>WhatsApp</button>
              <button className="button small" type="button" onClick={copyShareLink}>{copied ? "Lien copié" : "Partager / copier le lien"}</button>
              <form action={revokeAction}><button className="button small" type="submit" disabled={revoking}>{revoking ? "Désactivation…" : "Désactiver"}</button></form>
            </div> : <form action={shareAction}><button className="button small primary" type="submit" disabled={sharing}>{sharing ? "Création…" : "Partager le catalogue"}</button></form>}
          </div>
        </div>
        {shareState.error && <p className="auth-error" role="alert">{shareState.error}</p>}
        {revokeState.error && <p className="auth-error" role="alert">{revokeState.error}</p>}
        {shareToken && <p className="note">Le lien public donne accès aux articles actifs du catalogue.</p>}
        {loadError && <p className="auth-error" role="alert">Impossible de charger le catalogue. Vérifiez que les migrations Supabase sont appliquées.</p>}
        {items.length === 0 ? <p className="empty">Votre catalogue est vide pour le moment.</p> : (
          <div className="scroll"><table><thead><tr><th>Nom</th><th>Unité</th><th>Devise</th><th className="right">Prix</th><th>État</th><th /></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.unit}</td><td>{item.currency}</td><td className="right">{formatMinorAmount(item.price_amount, item.currency)}</td><td>{item.is_active ? "Actif" : "Archivé"}</td><td><div className="share-actions catalog-item-actions">{item.is_active && (shareToken ? <button className="button small ok" type="button" onClick={() => shareItemOnWhatsApp(item.name)}>Partager</button> : <form action={shareAction}><button className="button small" type="submit" disabled={sharing}>Activer le partage</button></form>)}{item.is_active && <form action={archiveCatalogItemAction}><input type="hidden" name="id" value={item.id} /><button className="button small" type="submit">Archiver</button></form>}</div></td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
