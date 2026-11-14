"use client";

import { useActionState } from "react";
import { updateSupportMessageStatusAction } from "@/app/actions/support";

type SupportMessage = {
  id: string;
  sender_name: string;
  sender_email: string;
  category: "question" | "suggestion" | "issue";
  subject: string;
  message: string;
  status: "new" | "read" | "resolved";
  created_at: string;
};

const categoryLabels: Record<SupportMessage["category"], string> = {
  question: "Question",
  suggestion: "Suggestion",
  issue: "Problème",
};

const statusLabels: Record<SupportMessage["status"], string> = {
  new: "Nouveau",
  read: "Lu",
  resolved: "Traité",
};

function SupportStatusForm({ message }: { message: SupportMessage }) {
  const [state, formAction, pending] = useActionState(updateSupportMessageStatusAction, {});

  return (
    <form action={formAction} className="support-status-form">
      <input type="hidden" name="id" value={message.id} />
      <label className="sr-only" htmlFor={`support-status-${message.id}`}>État du message {message.subject}</label>
      <select id={`support-status-${message.id}`} name="status" defaultValue={message.status}>
        <option value="new">Nouveau</option>
        <option value="read">Lu</option>
        <option value="resolved">Traité</option>
      </select>
      <button className="button small" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</button>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="message" role="status">{state.success}</p>}
    </form>
  );
}

export default function SupportInbox({ messages, loadError }: { messages: SupportMessage[]; loadError: boolean }) {
  return (
    <main className="workspace-wrap support-inbox">
      <h1>Messages reçus</h1>
      <p className="lead">Questions, signalements et suggestions envoyés depuis Facturo.</p>
      {loadError && <p className="auth-error" role="alert">Impossible de charger la boîte de réception. Vérifiez que la migration de support a été appliquée.</p>}
      {!loadError && messages.length === 0 && <section className="panel"><p className="empty">Aucun message pour le moment.</p></section>}
      {messages.map((message) => (
        <article className={`panel support-message support-message-${message.status}`} key={message.id}>
          <div className="support-message-heading">
            <div>
              <p className="eyebrow">{categoryLabels[message.category]} · {statusLabels[message.status]}</p>
              <h2>{message.subject}</h2>
              <p className="muted">
                <a href={`mailto:${message.sender_email}`}>{message.sender_name} · {message.sender_email}</a>
                {" · "}
                {new Date(message.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <SupportStatusForm message={message} />
          </div>
          <p className="support-message-body">{message.message}</p>
        </article>
      ))}
    </main>
  );
}
