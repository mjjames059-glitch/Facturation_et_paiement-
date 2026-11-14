"use client";

import { useActionState } from "react";
import { submitSupportMessageAction, type SupportActionState } from "@/app/actions/support";
import { CONTACT_EMAIL, CONTACT_PHONE, WHATSAPP_URL } from "@/lib/contact";

const initialState: SupportActionState = {};

const faq = [
  {
    question: "Comment créer et envoyer une facture ?",
    answer: "Ajoutez d’abord un client, puis ouvrez Factures et choisissez Nouvelle facture. Après vérification des lignes et du total, vous pourrez enregistrer et partager le document.",
  },
  {
    question: "Comment enregistrer un paiement partiel ?",
    answer: "Dans la liste des factures, utilisez l’action de paiement sur une facture envoyée. Saisissez le montant reçu : le solde restant est recalculé et la facture n’est considérée payée qu’une fois réglée.",
  },
  {
    question: "À quoi sert le taux USD/CDF des paramètres ?",
    answer: "Le taux sert à convertir les montants dans le tableau de bord pour comparer l’activité. Il ne modifie pas la devise ni les montants enregistrés sur les factures.",
  },
  {
    question: "Comment partager une facture avec mon client ?",
    answer: "Depuis la liste des factures, utilisez son lien de partage ou son PDF. Toute personne disposant d’un lien actif peut consulter le document correspondant ; partagez-le uniquement avec le destinataire prévu.",
  },
  {
    question: "Comment inviter un membre de mon entreprise ?",
    answer: "Un propriétaire ou gestionnaire peut ouvrir Équipe, créer une invitation et transmettre le lien à son collègue. Le rôle choisi détermine les actions disponibles.",
  },
  {
    question: "Les données de mon entreprise sont-elles séparées de celles des autres ?",
    answer: "Les données métier sont associées à l’espace de l’entreprise et protégées par les règles d’accès Supabase. Les liens de facture ou de catalogue que vous partagez sont accessibles à leurs destinataires.",
  },
];

export default function SupportScreen({ senderName, senderEmail }: { senderName: string; senderEmail: string }) {
  const [state, formAction, pending] = useActionState(submitSupportMessageAction, initialState);

  return (
    <main className="workspace-wrap support-page">
      <h1>Aide et contact</h1>
      <p className="lead">Trouvez une réponse ou envoyez une question, un problème ou une suggestion à l’administrateur.</p>

      <section className="panel support-form-panel" aria-labelledby="support-form-title">
        <h2 id="support-form-title">Écrire à l’administrateur</h2>
        <p className="muted">Votre message et les coordonnées de votre compte seront transmis à l’équipe Facturo.</p>
        <form action={formAction} className="support-form">
          <div className="grid-two">
            <div>
              <label htmlFor="support-sender-name">Nom</label>
              <input id="support-sender-name" value={senderName} readOnly />
            </div>
            <div>
              <label htmlFor="support-sender-email">Adresse e-mail de réponse</label>
              <input id="support-sender-email" type="email" value={senderEmail} readOnly />
            </div>
          </div>
          <div className="grid-two">
            <div>
              <label htmlFor="support-category">Type de message</label>
              <select id="support-category" name="category" defaultValue="question" required>
                <option value="question">Question</option>
                <option value="suggestion">Suggestion</option>
                <option value="issue">Signaler un problème</option>
              </select>
            </div>
            <div>
              <label htmlFor="support-subject">Sujet</label>
              <input id="support-subject" name="subject" required minLength={3} maxLength={160} />
            </div>
          </div>
          <div>
            <label htmlFor="support-message">Votre message</label>
            <textarea id="support-message" name="message" rows={6} required minLength={10} maxLength={5000} />
          </div>
          {state.error && <p className="auth-error" role="alert">{state.error}</p>}
          {state.success && <p className="message" role="status">{state.success}</p>}
          <div className="inline-action">
            <button className="button primary" disabled={pending}>{pending ? "Envoi…" : "Envoyer le message"}</button>
          </div>
        </form>
        <p className="support-contact-fallback">
          Vous pouvez aussi écrire à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> ou nous contacter sur{" "}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">WhatsApp · {CONTACT_PHONE}</a>.
        </p>
      </section>

      <section className="panel faq-panel" aria-labelledby="faq-title">
        <h2 id="faq-title">Questions fréquentes</h2>
        <div className="faq-list">
          {faq.map(({ question, answer }) => (
            <details className="faq-item" key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
