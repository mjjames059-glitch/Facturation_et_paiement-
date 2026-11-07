import Link from "next/link";
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_WHATSAPP_URL } from "@/lib/contact";

export default function ContactPanel() {
  return (
    <section className="panel contact-panel" aria-labelledby="contact-title">
      <div>
        <p className="eyebrow">Besoin d’aide ?</p>
        <h2 id="contact-title">Contactez Facturo</h2>
        <p className="muted">Notre équipe est disponible pour répondre à vos questions.</p>
      </div>
      <div className="contact-actions">
        <a href={`mailto:${CONTACT_EMAIL}`}>Écrire par e-mail</a>
        <a href={CONTACT_WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp : {CONTACT_PHONE}</a>
        <Link href="/politique-confidentialite">Politique de confidentialité</Link>
        <Link href="/conditions-utilisation">Conditions d’utilisation</Link>
      </div>
    </section>
  );
}
