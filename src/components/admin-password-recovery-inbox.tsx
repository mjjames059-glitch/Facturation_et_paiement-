"use client";

import { AdminRecoveryRequestForm } from "@/components/password-recovery";

export type AdminPasswordRecoveryRequest = {
  id: string;
  email: string;
  request_count: number;
  requested_at: string;
};

function requestDate(value: string) {
  return new Date(value).toLocaleString("fr-CD", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export default function AdminPasswordRecoveryInbox({
  requests,
}: {
  requests: AdminPasswordRecoveryRequest[];
}) {
  return (
    <main className="platform-admin-wrap">
      <header className="platform-admin-heading">
        <div>
          <h1>Récupération des accès</h1>
          <p>Les demandes apparaissent ici après deux envois de récupération dans la journée.</p>
        </div>
      </header>
      <section className="panel">
        <h2>Demandes à traiter</h2>
        {requests.length === 0
          ? <p className="muted">Aucune demande en attente.</p>
          : <div className="admin-recovery-list">{requests.map((request) => (
            <article className="admin-recovery-card" key={request.id}>
              <div>
                <h3>{request.email}</h3>
                <p className="muted">Demande reçue le {requestDate(request.requested_at)} · {request.request_count} demandes aujourd’hui</p>
              </div>
              <AdminRecoveryRequestForm requestId={request.id} />
            </article>
          ))}</div>}
      </section>
    </main>
  );
}
