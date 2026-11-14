"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect } from "react";
import { signOutAction } from "@/app/actions/auth";
import { switchWorkspaceAction, type WorkspaceActionState } from "@/app/actions/workspace";
import { SiteLinks } from "@/components/site-links";
import { getReadableTextColor } from "@/lib/branding";
import type { CompanyWorkspace } from "@/lib/supabase/auth";
import { getCompanyLogoUrl } from "@/lib/supabase/storage";

const initialWorkspaceState: WorkspaceActionState = {};

export default function WorkspaceHeader({ email, role, workspaces = [] }: { email: string; role?: string; workspaces?: CompanyWorkspace[] }) {
  const pathname = usePathname();
  const [workspaceState, workspaceAction, switchingWorkspace] = useActionState(switchWorkspaceAction, initialWorkspaceState);
  const currentWorkspace = workspaces.find((workspace) => workspace.is_current);
  useEffect(() => {
    const root = document.documentElement;
    const properties = ["--workspace-primary", "--workspace-accent", "--workspace-primary-text"] as const;
    const previousValues = properties.map((property) => root.style.getPropertyValue(property));
    const workspacePrimary = currentWorkspace?.brand_primary_color ?? "";
    const workspaceAccent = currentWorkspace?.brand_accent_color ?? "";
    const primary = /^#[0-9a-fA-F]{6}$/.test(workspacePrimary)
      ? workspacePrimary
      : "#2F6B3F";
    const accent = /^#[0-9a-fA-F]{6}$/.test(workspaceAccent)
      ? workspaceAccent
      : "#EAF3E7";
    root.style.setProperty("--workspace-primary", primary);
    root.style.setProperty("--workspace-accent", accent);
    root.style.setProperty("--workspace-primary-text", getReadableTextColor(primary));
    return () => properties.forEach((property, index) => {
      if (previousValues[index]) root.style.setProperty(property, previousValues[index]);
      else root.style.removeProperty(property);
    });
  }, [currentWorkspace?.brand_primary_color, currentWorkspace?.brand_accent_color]);
  const links = [
    { href: "/tableau-de-bord", label: "Tableau de bord" },
    { href: "/factures", label: "Factures" },
    { href: "/clients", label: "Clients" },
    { href: "/catalogue", label: "Catalogue" },
    { href: "/parametres", label: "Paramètres" },
    { href: "/aide", label: "Aide & FAQ" },
    ...(["owner", "manager"].includes(role ?? "") ? [{ href: "/equipe", label: "Équipe" }] : []),
  ];

  return (
    <header className="workspace-header">
      <div className="workspace-header-top">
        <div className="workspace-branding">
          {currentWorkspace?.logo_path && getCompanyLogoUrl(currentWorkspace.logo_path) && <div className="workspace-logo" role="img" aria-label={`Logo de ${currentWorkspace.company_name}`} style={{ backgroundImage: `url("${getCompanyLogoUrl(currentWorkspace.logo_path)}")` }} />}
          <div><Link href="/tableau-de-bord" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
            {currentWorkspace && <div className="workspace-identity"><span>Espace actif</span><strong>{currentWorkspace.company_name}</strong></div>}
          </div>
        </div>
        {workspaces.length > 1 && <form action={workspaceAction} className="workspace-switcher">
          <label htmlFor="active-workspace">Changer d’espace</label>
          <div><select id="active-workspace" name="company_id" defaultValue={currentWorkspace?.company_id}>
            {workspaces.map((workspace) => <option key={workspace.company_id} value={workspace.company_id}>{workspace.company_name}</option>)}
          </select><button className="button small" disabled={switchingWorkspace}>{switchingWorkspace ? "…" : "Ouvrir"}</button></div>
          {workspaceState.error && <p className="auth-error" role="alert">{workspaceState.error}</p>}
        </form>}
        <div className="workspace-user"><span>{email}</span><form action={signOutAction}><button className="button small">Se déconnecter</button></form></div>
      </div>
      <nav className="workspace-nav" aria-label="Navigation de l’espace">{links.map(({ href, label }) => {
        const active = pathname === href || (href === "/factures" && pathname.startsWith("/factures/")) || (href === "/aide" && pathname.startsWith("/aide")) || (href === "/admin/messages" && pathname.startsWith("/admin/messages"));
        return <Link key={href} href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>{label}</Link>;
      })}</nav>
      <SiteLinks className="workspace-legal-nav" />
    </header>
  );
}
