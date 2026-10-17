"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type View = "dash" | "inv" | "new" | "cli" | "cat" | "sign";
type Invoice = {
  no: string;
  client: string;
  date: string;
  amount: number;
  currency: "USD" | "CDF";
  status: "Payée" | "Envoyée" | "En retard" | "Brouillon";
  type: "Entreprise" | "Administration" | "Particulier";
};

const navigation: { id: View; label: string }[] = [
  { id: "dash", label: "Tableau de bord" },
  { id: "inv", label: "Factures" },
  { id: "new", label: "Nouvelle facture" },
  { id: "cli", label: "Clients" },
  { id: "cat", label: "Catalogue" },
  { id: "sign", label: "Inscription" },
];

const catalogue = [
  { name: "Plat du jour (portion)", price: 8 },
  { name: "Consultation (1 h)", price: 40 },
  { name: "Transport de marchandises", price: 60 },
  { name: "Maintenance informatique", price: 50 },
  { name: "Frais de scolarité (mois)", price: 35 },
  { name: "Location de salle (jour)", price: 120 },
  { name: "Plateau cocktail (50 pers.)", price: 150 },
  { name: "Travaux de peinture (m²)", price: 4 },
];

const initialInvoices: Invoice[] = [
  { no: "F-0001", client: "Traiteur Mama Zita", date: "02 oct.", amount: 450, currency: "USD", status: "Payée", type: "Entreprise" },
  { no: "F-0002", client: "Hôtel Gombe Palace", date: "09 oct.", amount: 320, currency: "USD", status: "Envoyée", type: "Entreprise" },
  { no: "F-0003", client: "Restaurant Chez Papy", date: "26 sept.", amount: 420000, currency: "CDF", status: "En retard", type: "Entreprise" },
  { no: "F-0004", client: "Agence Kin Events", date: "20 sept.", amount: 150, currency: "USD", status: "En retard", type: "Entreprise" },
  { no: "F-0005", client: "Restaurant Chez Papy", date: "14 oct.", amount: 96, currency: "USD", status: "Envoyée", type: "Entreprise" },
  { no: "F-0006", client: "Mairie de Lingwala", date: "12 oct.", amount: 600, currency: "USD", status: "Envoyée", type: "Administration" },
  { no: "F-0007", client: "Mme Béatrice K.", date: "15 oct.", amount: 24, currency: "USD", status: "Payée", type: "Particulier" },
];

const clients = [
  { name: "Restaurant Chez Papy", type: "Entreprise", phone: "+243 81 000 0001", due: 246 },
  { name: "Traiteur Mama Zita", type: "Entreprise", phone: "+243 82 000 0002", due: 0 },
  { name: "Hôtel Gombe Palace", type: "Entreprise", phone: "+243 99 000 0003", due: 320 },
  { name: "Agence Kin Events", type: "Entreprise", phone: "+243 85 000 0004", due: 150 },
  { name: "Mairie de Lingwala", type: "Administration", phone: "+243 81 000 0005", due: 600 },
  { name: "Mme Béatrice K.", type: "Particulier", phone: "+243 97 000 0006", due: 0 },
];

function amount(value: number, currency: "USD" | "CDF") {
  return currency === "CDF"
    ? `${Math.round(value).toLocaleString("fr-FR")} FC`
    : `$${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`;
}

function statusClass(status: Invoice["status"]) {
  return `tag tag-${status.toLowerCase().replace(" ", "-")}`;
}

export default function MaquetteApp() {
  const router = useRouter();
  const [view, setView] = useState<View>("dash");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [vat, setVat] = useState<"yes" | "no" | "unknown" | null>(null);
  const [currency, setCurrency] = useState<"USD" | "CDF">("USD");
  const [clientType, setClientType] = useState("Entreprise");
  const [lines, setLines] = useState<{ name: string; price: number; quantity: number }[]>([]);
  const [notice, setNotice] = useState("");

  const showNotice = (message: string) => setNotice(message);
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  function invoiceTable(items: Invoice[]) {
    if (!items.length) return <p className="empty">Aucune facture pour l’instant. Créez votre première facture en une minute.</p>;
    return (
      <div className="scroll">
        <table>
          <thead><tr><th>N°</th><th>Client</th><th>Date</th><th className="right">Montant</th><th>Statut</th><th /></tr></thead>
          <tbody>{items.map((invoice) => (
            <tr key={invoice.no}>
              <td>{invoice.no}</td><td>{invoice.client}</td><td>{invoice.date}</td>
              <td className="right">{amount(invoice.amount, invoice.currency)}</td>
              <td><span className={statusClass(invoice.status)}>{invoice.status}</span></td>
              <td>{invoice.status === "En retard" && <button className="button small primary" onClick={() => showNotice(`Message WhatsApp prêt pour ${invoice.client} · ${invoice.no}`)}>Relancer</button>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  function dashboard() {
    return (
      <>
        <h1>Bonjour Mama Zita</h1>
        <p className="lead">Voici l’état de vos encaissements ce mois-ci.</p>
        <div className="stats">
          <div className="stat big"><b>$1 590</b><span>Reste à encaisser</span></div>
          <div className="stat"><b>$1 640</b><span>Total facturé</span></div>
          <div className="stat"><b>$474</b><span>Déjà encaissé</span></div>
        </div>
        <section className="panel">
          <h2>Répartition des montants facturés</h2>
          <div className="bar"><i className="bar-paid" /><i className="bar-pending" /><i className="bar-late" /></div>
          <p className="note">Vert : payé · Jaune : en attente · Rouge : en retard</p>
        </section>
        <div className="stats breakdown">
          <div className="stat"><b>$1 626</b><span>Entreprises (B2B)</span></div>
          <div className="stat"><b>$600</b><span>Administrations (B2A)</span></div>
          <div className="stat"><b>$24</b><span>Particuliers (B2C)</span></div>
        </div>
        <section className="panel"><h2>À relancer en priorité</h2>{invoiceTable(initialInvoices.filter((invoice) => invoice.status === "En retard"))}</section>
      </>
    );
  }

  function newInvoice() {
    return (
      <>
        <h1>Nouvelle facture</h1>
        <p className="lead">Choisissez un client, ajoutez vos produits ou services, envoyez.</p>
        <div className="grid-two">
          <section className="panel">
            <label htmlFor="invoice-client">Client</label>
            <select id="invoice-client" value={clientType} onChange={(event) => setClientType(event.target.value)}>
              <option>Entreprise</option><option>Administration</option><option>Particulier</option>
            </select>
            <div className="inline-action"><button className="button small" onClick={() => setView("cli")}>+ Nouveau client</button></div>
            {clientType === "Administration" ? (
              <div className="context context-spice"><b>Facturation à une administration</b><label htmlFor="order-ref">N° de marché ou bon de commande</label><input id="order-ref" placeholder="Ex. BC-2026-114" /><p className="note">Prévoyez un suivi et des relances adaptés aux délais de paiement.</p></div>
            ) : clientType === "Particulier" ? (
              <div className="context context-leaf"><b>Vente à un particulier</b><p className="note">Le NIF est facultatif pour un particulier.</p></div>
            ) : (
              <div className="context context-grey"><b>Vente à une entreprise</b><p className="note">Le NIF du client est obligatoire.</p></div>
            )}
            <label htmlFor="currency">Devise</label>
            <select id="currency" value={currency} onChange={(event) => setCurrency(event.target.value as "USD" | "CDF")}><option value="USD">Dollar (USD)</option><option value="CDF">Franc congolais (CDF)</option></select>
            <label>Ajouter depuis le catalogue</label>
            <div className="dishes">{catalogue.map((item) => <button key={item.name} className="button small" onClick={() => setLines((current) => {
              const existing = current.find((line) => line.name === item.name);
              return existing ? current.map((line) => line.name === item.name ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { ...item, quantity: 1 }];
            })}>+ {item.name}</button>)}</div>
          </section>
          <section className="panel">
            <h2>Lignes de la facture</h2>
            {lines.length ? lines.map((line) => <div className="invoice-line" key={line.name}><span>{line.name}</span><input aria-label="Quantité" type="number" min="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((entry) => entry.name === line.name ? { ...entry, quantity: Math.max(1, Number(event.target.value)) } : entry))} /><span>{amount(line.quantity * line.price * (currency === "CDF" ? 2800 : 1), currency)}</span><button className="remove" aria-label="Retirer" onClick={() => setLines((current) => current.filter((entry) => entry.name !== line.name))}>×</button></div>) : <p className="empty">Rien d’ajouté. Touchez un article du catalogue.</p>}
            <div className="total"><span>Total</span><span>{amount(total * (currency === "CDF" ? 2800 : 1), currency)}</span></div>
            <p className="note">Document commercial, non certifié par la DGI (offre de base).</p>
            <div className="actions"><button className="button primary" onClick={() => showNotice("L’enregistrement des factures sera activé à l’étape Factures.")}>Enregistrer et envoyer sur WhatsApp</button><button className="button" onClick={() => showNotice("L’enregistrement des brouillons sera activé à l’étape Factures.")}>Enregistrer en brouillon</button></div>
          </section>
        </div>
      </>
    );
  }

  function clientScreen() {
    return (
      <>
        <h1>Clients</h1><p className="lead">Votre carnet de clients, avec ce qu’ils vous doivent.</p>
        <section className="panel">
          <h2>Ajouter un client</h2>
          <div className="grid-two">
            <div><label htmlFor="client-name">Nom du client</label><input id="client-name" placeholder="Ex. Restaurant Le Palmier" /></div>
            <div><label htmlFor="client-kind">Type de client</label><select id="client-kind"><option>Entreprise</option><option>Administration</option><option>Particulier</option></select></div>
            <div><label htmlFor="client-phone">Téléphone (WhatsApp)</label><input id="client-phone" type="tel" placeholder="+243 …" /></div>
            <div><label htmlFor="client-nif">NIF</label><input id="client-nif" placeholder="Obligatoire sauf pour un particulier" /></div>
          </div>
          <div className="inline-action"><button className="button primary" onClick={() => showNotice("La gestion des clients sera activée à l’étape Clients et catalogue.")}>Ajouter le client</button></div>
        </section>
        <section className="panel"><div className="scroll"><table><thead><tr><th>Nom</th><th>Type</th><th>Téléphone</th><th className="right">Reste dû</th></tr></thead><tbody>{clients.map((client) => <tr key={client.name}><td>{client.name}</td><td>{client.type}</td><td>{client.phone}</td><td className="right">{amount(client.due, "USD")}</td></tr>)}</tbody></table></div></section>
      </>
    );
  }

  function signup() {
    return (
      <>
        <h1>Créer votre compte</h1><p className="lead">Trois questions pour adapter l’outil à votre activité.</p>
        <section className="panel">
          <label htmlFor="company-name">Nom de l’entreprise</label><input id="company-name" placeholder="Ex. Traiteur Mama Zita" />
          <label htmlFor="industry">Secteur d’activité</label><select id="industry"><option>Restauration et alimentation</option><option>Services et conseil</option><option>Commerce et distribution</option><option>BTP et construction</option><option>Transport et logistique</option><option>Éducation</option><option>Autre</option></select>
          <label>Vos clients sont</label><div className="dishes choices"><label><input type="checkbox" defaultChecked /> Des entreprises</label><label><input type="checkbox" defaultChecked /> Des administrations</label><label><input type="checkbox" defaultChecked /> Des particuliers</label></div>
          <label>Êtes-vous assujetti à la TVA ?</label>
          <div className="dishes">{([ ["no", "Non"], ["yes", "Oui"], ["unknown", "Je ne sais pas"] ] as const).map(([value, label]) => <button key={value} className={`button${vat === value ? " selected" : ""}`} onClick={() => setVat(value)}>{label}</button>)}</div>
        </section>
        {vat === "no" && <><div className="message">Parfait. Vous pouvez créer vos factures et suivre vos paiements dès maintenant.</div><button className="button primary" onClick={() => showNotice("La création de compte sera activée à l’étape Authentification.")}>Créer mon compte</button></>}
        {vat === "yes" && <section className="panel context-spice"><b>Option DGI bientôt disponible.</b><p>Rejoignez la liste d’attente et nous vous préviendrons de son lancement. Vous pouvez commencer avec l’offre de base.</p><button className="button primary" onClick={() => showNotice("L’inscription à la liste d’attente sera activée à l’étape Authentification.")}>Rejoindre la liste d’attente</button></section>}
        {vat === "unknown" && <section className="panel"><p>Pas de souci. Votre comptable ou votre carte de contribuable peut vous le dire. En attendant, vous pouvez commencer avec l’offre de base.</p><button className="button" onClick={() => showNotice("La création de compte sera activée à l’étape Authentification.")}>Commencer avec l’offre de base</button></section>}
      </>
    );
  }

  const page = view === "dash" ? dashboard() : view === "new" ? newInvoice() : view === "cli" ? clientScreen() : view === "sign" ? signup() : <><h1>Factures</h1><p className="lead">Toutes vos factures et leur statut.</p><section className="panel">{invoiceTable(initialInvoices)}</section></>;

  return (
    <div className="app-shell" data-theme={theme}>
      <div className="wrap">
        <header className="header">
          <a className="brand" href="#accueil" onClick={(event) => { event.preventDefault(); setView("dash"); }} aria-label="Facturo, accueil">Facturo<small>Facturation et suivi des paiements</small></a>
          <div className="header-actions">
          <nav aria-label="Navigation principale">{navigation.map((item) => <button key={item.id} className={view === item.id ? "on" : ""} onClick={() => { setNotice(""); if (item.id === "sign") { router.push("/auth/sign-up"); return; } if (item.id === "cli") { router.push("/clients"); return; } if (item.id === "cat") { router.push("/catalogue"); return; } if (item.id === "inv") { router.push("/factures"); return; } if (item.id === "new") { router.push("/factures/nouvelle"); return; } setView(item.id); }}>{item.label}</button>)}</nav>
            <button className="theme-toggle" aria-label={theme === "light" ? "Activer le thème sombre" : "Activer le thème clair"} title={theme === "light" ? "Thème sombre" : "Thème clair"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? "☾" : "☀"}</button>
          </div>
        </header>
        <main>
          {notice && <div className="message" role="status">{notice}</div>}
          {page}
        </main>
        <p className="footnote">Maquette de démonstration : les données sont fictives et rien n’est enregistré. Taux utilisé pour les totaux : 1 USD = 2 800 CDF.</p>
      </div>
    </div>
  );
}
