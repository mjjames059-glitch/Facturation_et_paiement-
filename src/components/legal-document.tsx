import Link from "next/link";
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_WHATSAPP_URL } from "@/lib/contact";

export function LegalDocument({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="public-shell legal-shell">
      <article className="public-invoice legal-document">
        <header className="legal-header">
          <Link href="/" className="brand">
            Facturo
            <small>Facturation et suivi des paiements</small>
          </Link>
          <nav aria-label="Documents juridiques">
            <Link href="/politique-confidentialite">Confidentialité</Link>
            <Link href="/conditions-utilisation">Conditions d’utilisation</Link>
          </nav>
        </header>
        <p className="eyebrow">Facturo · Informations légales</p>
        <h1>{title}</h1>
        <p className="lead">Dernière mise à jour : 27 octobre 2026</p>
        <div className="legal-content">{children}</div>
        <footer className="legal-footer">
          <span>Facturo — James Muhimizi Nyabenda, RDC</span>
          <div className="legal-contact">
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <a href={CONTACT_WHATSAPP_URL}>WhatsApp : {CONTACT_PHONE}</a>
          </div>
        </footer>
      </article>
    </main>
  );
}
