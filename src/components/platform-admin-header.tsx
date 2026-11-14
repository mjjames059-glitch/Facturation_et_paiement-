import Link from "next/link";
import { signOutPlatformAdminAction } from "@/app/actions/auth";
import type { ThemePreference } from "@/lib/theme";
import { ThemeInitializer } from "@/components/theme-preference-control";

export default function PlatformAdminHeader({ email, themePreference }: { email: string; themePreference: ThemePreference }) {
  return (
    <>
      <ThemeInitializer themePreference={themePreference} />
      <header className="workspace-header platform-admin-header">
        <div className="workspace-header-top">
          <Link href="/admin" className="brand">Facturo<small>Administration plateforme</small></Link>
          <nav className="workspace-nav" aria-label="Administration de la plateforme">
            <Link href="/admin">Entreprises</Link>
            <Link href="/admin/messages">Messages reçus</Link>
            <Link href="/admin/recoveries">Récupération des accès</Link>
          </nav>
          <div className="workspace-user">
            <span>{email}</span>
            <form action={signOutPlatformAdminAction}><button className="button small">Se déconnecter</button></form>
          </div>
        </div>
      </header>
    </>
  );
}
