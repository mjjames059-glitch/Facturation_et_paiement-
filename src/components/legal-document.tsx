import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ContactPanel, SiteLinks } from "@/components/site-links";
import { CONTACT_EMAIL } from "@/lib/contact";

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
          <div className="legal-header-actions">
            <SiteLinks className="legal-site-links" />
            <BackLink />
          </div>
        </header>
        <p className="eyebrow">Facturo · Informations légales</p>
        <h1>{title}</h1>
        <p className="lead">Dernière mise à jour : 27 octobre 2026</p>
        <div className="legal-content">{children}</div>
        <ContactPanel />
        <footer className="legal-footer">
          <span>Facturo — James Muhimizi Nyabenda, RDC</span>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </footer>
      </article>
    </main>
  );
}
