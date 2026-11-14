import Link from "next/link";
import { signOutPlatformAdminAction } from "@/app/actions/auth";

export default function PlatformAdminHeader({ email }: { email: string }) {
  return (
    <header className="workspace-header platform-admin-header">
      <div className="workspace-header-top">
        <Link href="/admin" className="brand">Facturo<small>Administration plateforme</small></Link>
        <div className="workspace-user">
          <span>{email}</span>
          <form action={signOutPlatformAdminAction}><button className="button small">Se déconnecter</button></form>
        </div>
      </div>
      <nav className="workspace-nav" aria-label="Administration de la plateforme">
        <Link href="/admin">Entreprises</Link>
        <Link href="/admin/messages">Messages reçus</Link>
      </nav>
    </header>
  );
}
