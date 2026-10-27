import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Conditions d’utilisation — Facturo",
  description: "Conditions d’accès et d’utilisation du service Facturo.",
};

export default function TermsOfUsePage() {
  return (
    <LegalDocument title="Conditions d’utilisation">
      <p>
        Les présentes conditions encadrent l’accès à Facturo, un outil de
        facturation et de suivi des paiements édité par James Muhimizi Nyabenda,
        porteur du projet (activité en création), en République démocratique du
        Congo. En créant un compte ou en utilisant le service, vous acceptez ces
        conditions.
      </p>

      <h2>Service en bêta gratuite</h2>
      <p>
        Facturo est actuellement proposé gratuitement en version bêta, sans
        paiement ni abonnement facturé dans l’application. Les fonctionnalités
        peuvent évoluer, être limitées ou indisponibles pendant cette période.
        Aucune disponibilité continue ni conservation permanente des données
        n’est garantie.
      </p>

      <h2>Compte et sécurité</h2>
      <p>
        Vous devez fournir des informations exactes, garder vos moyens de
        connexion confidentiels et signaler toute utilisation non autorisée de
        votre compte à{" "}
        <a href="mailto:james.m.nyabenda@gmail.com">james.m.nyabenda@gmail.com</a>.
        Vous êtes responsable des actions effectuées depuis votre compte et de
        la gestion des accès accordés aux membres de votre équipe.
      </p>

      <h2>Utilisation autorisée</h2>
      <p>
        Vous êtes responsable de la légalité, de l’exactitude et de la
        pertinence des informations saisies, notamment celles concernant vos
        clients, vos factures et vos paiements. Vous devez disposer des droits
        ou autorisations nécessaires pour enregistrer ces informations et
        respecter les obligations comptables, fiscales et de protection des
        données qui vous sont applicables.
      </p>
      <p>
        Vous ne devez pas utiliser Facturo pour enfreindre la loi, porter
        atteinte aux droits d’autrui, tenter de compromettre le service ou
        contourner ses mesures de sécurité. Vous êtes également responsable des
        liens de facture ou de catalogue que vous choisissez de partager.
      </p>

      <h2>Documents et liens partagés</h2>
      <p>
        Facturo fournit des outils de création et de suivi ; il ne certifie pas
        l’exactitude juridique, fiscale ou comptable des documents générés. Les
        liens de partage peuvent rendre les informations concernées accessibles
        à toute personne qui les obtient. Vérifiez leur contenu avant de les
        transmettre et révoquez-les lorsque vous ne souhaitez plus qu’ils
        fonctionnent.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Facturo et ses éléments (notamment le nom, l’interface et le logiciel)
        restent protégés par les droits applicables. Ces conditions vous
        accordent un droit personnel, limité et révocable d’utiliser le service
        conformément à sa destination. Vous conservez les droits sur les
        contenus que vous fournissez.
      </p>

      <h2>Disponibilité, suspension et fin d’utilisation</h2>
      <p>
        La bêta peut être modifiée, suspendue ou arrêtée. Nous pouvons
        restreindre ou suspendre un compte en cas d’utilisation illicite,
        d’atteinte à la sécurité ou de violation des présentes conditions. Vous
        pouvez cesser d’utiliser Facturo et demander la suppression de vos
        données à{" "}
        <a href="mailto:james.m.nyabenda@gmail.com">james.m.nyabenda@gmail.com</a>,
        sous réserve des obligations légales de conservation.
      </p>

      <h2>Responsabilité</h2>
      <p>
        Dans la mesure permise par la loi, Facturo est fourni « en l’état » pour
        une phase bêta. L’éditeur ne garantit pas l’absence d’interruption ni
        l’adéquation du service à un besoin particulier. Vous devez conserver
        vos propres documents et vérifier les informations avant de vous y
        fier. Aucune disposition ne limite une responsabilité qui ne peut être
        exclue selon la loi applicable.
      </p>

      <h2>Droit applicable et contact</h2>
      <p>
        Les présentes conditions sont soumises au droit applicable en
        République démocratique du Congo, sous réserve des règles impératives
        qui s’appliquent à l’utilisateur. Pour toute question ou réclamation,
        contactez James Muhimizi Nyabenda à{" "}
        <a href="mailto:james.m.nyabenda@gmail.com">james.m.nyabenda@gmail.com</a>.
      </p>

      <p>
        Pour connaître les traitements de données effectués par Facturo,
        consultez la{" "}
        <a href="/politique-confidentialite">politique de confidentialité</a>.
      </p>
    </LegalDocument>
  );
}
