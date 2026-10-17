"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";

export default function WorkspaceHeader({ email }: { email: string }) {
  const pathname = usePathname();
  const links = [
    { href: "/tableau-de-bord", label: "Tableau de bord" },
    { href: "/factures", label: "Factures" },
    { href: "/clients", label: "Clients" },
    { href: "/catalogue", label: "Catalogue" },
    { href: "/parametres", label: "Paramètres" },
  ];

  return (
    <header className="workspace-header">
      <Link href="/tableau-de-bord" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
      <nav className="workspace-nav" aria-label="Navigation de l’espace">{links.map(({ href, label }) => {
        const active = pathname === href || (href === "/factures" && pathname.startsWith("/factures/"));
        return <Link key={href} href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>{label}</Link>;
      })}</nav>
      <div className="workspace-user"><span>{email}</span><form action={signOutAction}><button className="button small">Se déconnecter</button></form></div>
    </header>
  );
}
