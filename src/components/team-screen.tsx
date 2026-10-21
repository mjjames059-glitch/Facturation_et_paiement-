"use client";

import { useActionState, useState } from "react";
import { createTeamInvitationAction, revokeTeamInvitationAction, type TeamActionState } from "@/app/actions/team";

type MemberRole = "owner" | "manager" | "accountant" | "collaborator" | "viewer";
type TeamMember = { user_id: string; role: MemberRole; display_name: string | null; created_at: string };
type PendingInvitation = { id: string; email: string; role: Exclude<MemberRole, "owner">; created_at: string; expires_at: string };

const roleLabels: Record<MemberRole, string> = {
  owner: "Propriétaire",
  manager: "Gestionnaire",
  accountant: "Comptable",
  collaborator: "Collaborateur",
  viewer: "Lecture seule",
};

const initialState: TeamActionState = {};

export default function TeamScreen({ members, invitations, role }: { members: TeamMember[]; invitations: PendingInvitation[]; role: "owner" | "manager" }) {
  const [state, formAction, pending] = useActionState(createTeamInvitationAction, initialState);
  const [copied, setCopied] = useState(false);
  const availableRoles: [string, string][] = [
    ...(role === "owner" ? [["manager", "Gestionnaire — accès complet"] as [string, string]] : []),
    ["accountant", "Comptable — factures et paiements"],
    ["collaborator", "Collaborateur — clients, catalogue et factures"],
    ["viewer", "Lecture seule"],
  ];

  async function copyInvitationLink() {
    if (!state.invitationUrl) return;
    await navigator.clipboard.writeText(state.invitationUrl);
    setCopied(true);
  }

  return (
    <div className="workspace-wrap">
      <h1>Équipe</h1>
      <p className="lead">Invitez vos collègues dans l’espace de votre entreprise et choisissez ce qu’ils peuvent faire.</p>

      <section className="panel">
        <h2>Inviter un collaborateur</h2>
        <p className="muted">Comptable : factures et paiements. Collaborateur : clients, catalogue et factures. Lecture seule : consultation des données. Le gestionnaire administre aussi les paramètres et l’équipe.</p>
        <form action={formAction} className="team-invite-form">
          <div><label htmlFor="invite-email">Adresse e-mail</label><input id="invite-email" type="email" name="email" required maxLength={254} placeholder="collegue@entreprise.com" /></div>
          <div><label htmlFor="invite-role">Rôle dans Facturo</label><select id="invite-role" name="role">{availableRoles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <button className="button primary" disabled={pending}>{pending ? "Création…" : "Créer le lien d’invitation"}</button>
        </form>
        {state.error && <p className="auth-error" role="alert">{state.error}</p>}
        {state.success && <p className="message" role="status">{state.success}</p>}
        {state.invitationUrl && <div className="context context-leaf"><label htmlFor="new-invite-link">Lien privé à transmettre</label><div className="team-link-row"><input id="new-invite-link" value={state.invitationUrl} readOnly onFocus={(event) => event.currentTarget.select()} /><button type="button" className="button" onClick={copyInvitationLink}>{copied ? "Lien copié" : "Copier le lien"}</button></div><p className="note">Ce lien ne peut servir qu’une fois et expire après 48 heures.</p></div>}
      </section>

      <section className="panel">
        <h2>Membres ({members.length})</h2>
        {members.length === 0 ? <p className="empty">Aucun membre dans l’équipe.</p> : <div className="scroll"><table className="team-table"><thead><tr><th>Nom</th><th>Rôle</th><th>Depuis</th></tr></thead><tbody>{members.map((member) => <tr key={member.user_id}><td>{member.display_name || `Membre ${member.user_id.slice(0, 8)}`}</td><td><span className="tag tag-brouillon">{roleLabels[member.role]}</span></td><td>{new Date(member.created_at).toLocaleDateString("fr-FR")}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="panel">
        <h2>Invitations en attente ({invitations.length})</h2>
        {invitations.length === 0 ? <p className="empty">Aucune invitation en attente.</p> : <div className="scroll"><table className="team-table"><thead><tr><th>Adresse e-mail</th><th>Rôle</th><th>Expire le</th><th /></tr></thead><tbody>{invitations.map((invitation) => <tr key={invitation.id}><td>{invitation.email}</td><td>{roleLabels[invitation.role]}</td><td>{new Date(invitation.expires_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td><td><form action={revokeTeamInvitationAction}><input type="hidden" name="invitation_id" value={invitation.id} /><button className="button small" aria-label={`Révoquer l’invitation de ${invitation.email}`}>Révoquer</button></form></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
