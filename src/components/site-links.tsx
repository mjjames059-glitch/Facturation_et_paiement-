import Link from "next/link";
import { CONTACT_EMAIL, CONTACT_PHONE, WHATSAPP_URL } from "@/lib/contact";

export function SiteLinks({ className }: { className: string }) {
  return (
    <nav className={className} aria-label="Informations et contact">
      <Link href="/politique-confidentialite">Confidentialité</Link>
      <Link href="/conditions-utilisation">Conditions d’utilisation</Link>
      <a href={`mailto:${CONTACT_EMAIL}`}>E-mail</a>
      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">WhatsApp · {CONTACT_PHONE}</a>
    </nav>
  );
}

export function ContactPanel({ variant = "legal" }: { variant?: "legal" | "dashboard" }) {
  return (
    <section className={`legal-contact ${variant === "dashboard" ? "dashboard-contact" : ""}`} aria-labelledby="legal-contact-title">
      <div>
        <p className="eyebrow">Une question ?</p>
        <h2 id="legal-contact-title">Contactez Facturo</h2>
        <p>Écrivez-nous par e-mail ou envoyez-nous un message sur WhatsApp.</p>
      </div>
      <div className="legal-contact-actions">
        <a className="button" href={`mailto:${CONTACT_EMAIL}`}>Envoyer un e-mail</a>
        <a className="button primary" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          WhatsApp · {CONTACT_PHONE}
        </a>
      </div>
    </section>
  );
}
