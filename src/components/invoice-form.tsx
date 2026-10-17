"use client";

import { useActionState, useMemo, useState } from "react";
import { createInvoiceAction, type InvoiceActionState } from "@/app/actions/invoices";
import { formatMinorAmount, humanPriceFromMinor, lineTotalMinor, parseMoneyToMinorUnits, type CurrencyCode } from "@/lib/money";

type ClientOption = { id: string; name: string; client_type: "b2b" | "b2a" | "b2c" };
type CatalogOption = { id: string; name: string; price_amount: string | number; currency: CurrencyCode; unit: string };
type DraftLine = { key: string; description: string; quantity: string; price: string; unit: string; catalog_item_id: string };

const initialState: InvoiceActionState = {};

export default function InvoiceForm({ clients, catalog, today, loadError = false }: { clients: ClientOption[]; catalog: CatalogOption[]; today: string; loadError?: boolean }) {
  const [state, formAction, pending] = useActionState(createInvoiceAction, initialState);
  const [clientId, setClientId] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [issuedAt, setIssuedAt] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [freeDescription, setFreeDescription] = useState("");
  const [freePrice, setFreePrice] = useState("");
  const [freeUnit, setFreeUnit] = useState("unité");
  const [lineError, setLineError] = useState("");

  const selectedClient = clients.find((client) => client.id === clientId);
  const matchingCatalog = useMemo(() => catalog.filter((item) => item.currency === currency), [catalog, currency]);
  const total = lines.reduce((sum, line) => {
    const price = parseMoneyToMinorUnits(line.price, currency);
    return price === null ? sum : sum + lineTotalMinor(price, line.quantity);
  }, BigInt(0));

  function addCatalogItem(item: CatalogOption) {
    setLines((current) => [...current, {
      key: globalThis.crypto.randomUUID(),
      description: item.name,
      quantity: "1",
      price: humanPriceFromMinor(item.price_amount, currency),
      unit: item.unit,
      catalog_item_id: item.id,
    }]);
  }

  function addFreeLine() {
    if (!freeDescription.trim()) {
      setLineError("Saisissez une description pour cette ligne.");
      return;
    }
    if (parseMoneyToMinorUnits(freePrice, currency) === null) {
      setLineError(currency === "CDF" ? "Saisissez un prix entier en CDF." : "Saisissez un prix valide en USD (par exemple 25,50).");
      return;
    }
    setLineError("");
    setLines((current) => [...current, {
      key: globalThis.crypto.randomUUID(),
      description: freeDescription.trim(),
      quantity: "1",
      price: freePrice,
      unit: freeUnit.trim() || "unité",
      catalog_item_id: "",
    }]);
    setFreeDescription("");
    setFreePrice("");
    setFreeUnit("unité");
  }

  function updateLine(key: string, field: "description" | "quantity" | "price" | "unit", value: string) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: value } : line));
  }

  return (
    <div className="workspace-wrap">
      <h1>Nouvelle facture</h1>
      <p className="lead">Choisissez un client, ajoutez vos produits ou services, puis enregistrez.</p>
      {loadError && <p className="auth-error" role="alert">Impossible de charger certains clients ou articles du catalogue.</p>}
      <form action={formAction}>
        <input type="hidden" name="lines" value={JSON.stringify(lines.map((line) => ({ description: line.description, quantity: line.quantity, price: line.price, unit: line.unit, catalog_item_id: line.catalog_item_id })))} readOnly />
        <div className="grid-two invoice-layout">
          <section className="panel">
            <label htmlFor="invoice-client">Client</label>
            <select id="invoice-client" name="client_id" value={clientId} onChange={(event) => setClientId(event.target.value)} required>
              <option value="">Sélectionner un client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.client_type === "b2a" ? "Administration" : client.client_type === "b2c" ? "Particulier" : "Entreprise"})</option>)}
            </select>
            {clients.length === 0 && <p className="note">Ajoutez d’abord un client pour créer une facture.</p>}
            {selectedClient?.client_type === "b2a" && <div className="context context-spice"><b>Facturation à une administration</b><label htmlFor="order-reference">N° de marché ou bon de commande</label><input id="order-reference" name="order_reference" maxLength={200} placeholder="Ex. BC-2026-114" /><p className="note">Prévoyez un suivi et des relances adaptés aux délais de paiement.</p></div>}
            {selectedClient?.client_type === "b2b" && <div className="context context-grey"><b>Vente à une entreprise</b><p className="note">Le NIF du client est obligatoire.</p></div>}
            {selectedClient?.client_type === "b2c" && <div className="context context-leaf"><b>Vente à un particulier</b><p className="note">Le NIF est facultatif pour un particulier.</p></div>}
            {selectedClient?.client_type !== "b2a" && <input type="hidden" name="order_reference" value="" />}
            <div className="grid-two date-fields">
              <div><label htmlFor="issued-at">Date de facture</label><input id="issued-at" name="issued_at" type="date" value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} required /></div>
              <div><label htmlFor="due-date">Date d’échéance</label><input id="due-date" name="due_date" type="date" min={issuedAt} value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></div>
            </div>
            <label htmlFor="invoice-currency">Devise</label>
            <select id="invoice-currency" name={lines.length === 0 ? "currency" : undefined} value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)} disabled={lines.length > 0}><option value="USD">Dollar (USD)</option><option value="CDF">Franc congolais (CDF)</option></select>
            {lines.length > 0 && <input type="hidden" name="currency" value={currency} />}
            {lines.length > 0 && <p className="field-hint">Retirez toutes les lignes avant de changer la devise.</p>}
            <label>Ajouter depuis le catalogue</label>
            {matchingCatalog.length ? <div className="dishes">{matchingCatalog.map((item) => <button className="button small" key={item.id} type="button" onClick={() => addCatalogItem(item)}>+ {item.name} · {formatMinorAmount(item.price_amount, currency)}</button>)}</div> : <p className="empty">Aucun article dans cette devise. Vous pouvez ajouter une ligne libre.</p>}
            <div className="free-line-form">
              <label htmlFor="free-description">Ligne libre</label>
              <div className="free-line-fields"><input id="free-description" value={freeDescription} onChange={(event) => { setFreeDescription(event.target.value); setLineError(""); }} placeholder="Description" maxLength={200} /><input aria-label="Prix de la ligne libre" value={freePrice} onChange={(event) => { setFreePrice(event.target.value); setLineError(""); }} inputMode="decimal" placeholder={currency === "USD" ? "Prix en USD" : "Prix en CDF"} /><input aria-label="Unité de la ligne libre" value={freeUnit} onChange={(event) => setFreeUnit(event.target.value)} placeholder="Unité" maxLength={40} /><button className="button small" type="button" onClick={addFreeLine}>Ajouter</button></div>
              {lineError && <p className="auth-error" role="alert">{lineError}</p>}
            </div>
          </section>
          <section className="panel">
            <h2>Lignes de la facture</h2>
            {lines.length ? lines.map((line) => {
              const unitPrice = parseMoneyToMinorUnits(line.price, currency);
              const lineTotal = unitPrice === null ? null : lineTotalMinor(unitPrice, line.quantity);
              return <div className="editable-invoice-line" key={line.key}>
                <input aria-label="Description" value={line.description} onChange={(event) => updateLine(line.key, "description", event.target.value)} maxLength={200} />
                <input aria-label="Quantité" type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} />
                <input aria-label="Prix unitaire" inputMode="decimal" value={line.price} onChange={(event) => updateLine(line.key, "price", event.target.value)} />
                <span className="line-total">{lineTotal === null ? "—" : formatMinorAmount(lineTotal, currency)}</span>
                <button className="remove" type="button" aria-label="Retirer la ligne" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>×</button>
              </div>;
            }) : <p className="empty">Rien d’ajouté. Choisissez un article du catalogue ou ajoutez une ligne libre.</p>}
            <div className="total"><span>Total</span><span>{formatMinorAmount(total, currency)}</span></div>
            <p className="note">Document commercial, non certifié par la DGI.</p>
            {(!clientId || !dueDate || lines.length === 0) && <p className="form-requirements" role="status">Pour enregistrer : choisissez un client, indiquez la date d’échéance et ajoutez au moins une ligne.</p>}
            {state.error && <p className="auth-error" role="alert">{state.error}</p>}
            <div className="actions"><button className="button primary" disabled={pending || lines.length === 0 || !dueDate}>{pending ? "Enregistrement…" : "Enregistrer le brouillon"}</button></div>
          </section>
        </div>
      </form>
    </div>
  );
}
