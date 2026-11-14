import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";

export default function PlatformAdminHeader({ email }: { email: string }) {
  return (
    <header className="workspace-header platform-admin-header">
      <Link href="/admin" className="brand">Facturo<small>Administration plateforme</small></Link>
      <nav className="workspace-nav" aria-label="Administration de la plateforme">
        <Link href="/admin">Entreprises</Link>
        <Link href="/admin/messages">Messages reçus</Link>
      </nav>
      <div className="workspace-user">
        <span>{email}</span>
        <form action={signOutAction}><button className="button small">Se déconnecter</button></form>
      </div>
    </header>
  );
}
