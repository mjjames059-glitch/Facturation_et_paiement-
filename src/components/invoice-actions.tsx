"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useState } from "react";
import { markInvoiceSentAction, registerPaymentAction, type InvoiceActionState } from "@/app/actions/invoices";

const initialState: InvoiceActionState = {};

export default function InvoiceActions({
  invoiceId,
  status,
  today,
  token,
  clientName,
  clientPhone,
  invoiceNumber,
  amountText,
  reminderAmountText,
  reminderOnly = false,
}: {
  invoiceId: string;
  status: string;
  today: string;
  token: string;
  clientName: string;
  clientPhone: string;
  invoiceNumber: string;
  amountText: string;
  reminderAmountText: string;
  reminderOnly?: boolean;
}) {
  const [sendState, sendAction, sending] = useActionState(markInvoiceSentAction, initialState);
  const [paymentState, paymentAction, paying] = useActionState(registerPaymentAction, initialState);
  const [copied, setCopied] = useState(false);

  function sendWhatsApp() {
    const url = `${window.location.origin}/f/${token}`;
    const message = `Bonjour ${clientName}, voici la facture ${invoiceNumber} de ${amountText} : ${url}`;
    const phone = clientPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  function sendReminder() {
    const url = `${window.location.origin}/f/${token}`;
    const message = `Bonjour ${clientName}, petit rappel amical : la facture ${invoiceNumber} de ${reminderAmountText} reste à régler. Pouvez-vous effectuer le paiement dès que possible ? Merci beaucoup ! ${url}`;
    const phone = clientPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/f/${token}`);
    setCopied(true);
  }

  const reminderButton = <button className="button small primary" type="button" onClick={sendReminder}>Relancer</button>;
  if (reminderOnly && status === "overdue") return reminderButton;

  if (status === "draft") return (
    <div className="invoice-actions">
      <form action={sendAction}><input type="hidden" name="invoice_id" value={invoiceId} /><button className="button small ok" disabled={sending}>{sending ? "Envoi…" : "Marquer envoyée"}</button></form>
      {sendState.error && <span className="auth-error" role="alert">{sendState.error}</span>}
    </div>
  );

  return (
    <div className="invoice-actions">
      <div className="share-actions"><Link className="button small" href={`/f/${token}`} target="_blank">Voir le lien</Link><Link className="button small" href={`/f/${token}/pdf`}>PDF</Link><button className="button small ok" type="button" onClick={sendWhatsApp}>WhatsApp</button><button className="button small" type="button" onClick={copyLink}>{copied ? "Lien copié" : "Copier le lien"}</button></div>
      {status === "paid" && <span className="muted">Paiement reçu</span>}
      {status === "overdue" && reminderButton}
      {status === "paid" ? null : <>
      <details>
        <summary className="button small">Marquer payée</summary>
        <form className="payment-form" action={paymentAction}>
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <label htmlFor={`paid-at-${invoiceId}`}>Date du paiement</label><input id={`paid-at-${invoiceId}`} type="date" name="paid_at" defaultValue={today} required />
          <label htmlFor={`payment-mode-${invoiceId}`}>Mode de paiement</label><select id={`payment-mode-${invoiceId}`} name="mode" defaultValue="cash"><option value="cash">Espèces</option><option value="bank_transfer">Virement bancaire</option><option value="check">Chèque</option><option value="mobile_money">Mobile Money (saisie manuelle)</option><option value="other">Autre</option></select>
          <button className="button small primary" disabled={paying}>{paying ? "Enregistrement…" : "Enregistrer le paiement"}</button>
          {paymentState.error && <span className="auth-error" role="alert">{paymentState.error}</span>}
        </form>
      </details>
      </>}
    </div>
  );
}
