import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Facturo",
  description: "Comment Facturo collecte, utilise et protège vos données.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Politique de confidentialité">
      <p>
        Cette politique explique comment Facturo collecte et utilise les
        informations nécessaires à la facturation et au suivi des paiements.
        Elle s’applique au site et aux espaces Facturo.
      </p>

      <h2>Responsable et contact</h2>
      <p>
        Facturo est édité par James Muhimizi Nyabenda, porteur du projet
        (activité en création), en République démocratique du Congo. Pour toute
        question, demande d’accès, de correction ou de suppression, écrivez à{" "}
        <a href="mailto:james.m.nyabenda@gmail.com">james.m.nyabenda@gmail.com</a>.
      </p>

      <h2>Données traitées</h2>
      <ul>
        <li>
          Compte et authentification : adresse e-mail, nom affiché, identifiant
          de compte et informations de connexion. Une connexion Google ou
          Facebook peut transmettre à Facturo les informations de profil
          autorisées par le fournisseur.
        </li>
        <li>
          Entreprise et équipe : nom, secteur, coordonnées professionnelles,
          informations fiscales renseignées, rôles des membres et adresses
          e-mail utilisées pour les invitations.
        </li>
        <li>
          Données de gestion saisies par l’utilisateur : coordonnées des
          clients, catalogue, factures, lignes de facture et paiements
          enregistrés, ainsi que les logos téléversés.
        </li>
        <li>
          Données techniques indispensables au fonctionnement et à la sécurité
          du service, notamment les cookies de session.
        </li>
      </ul>

      <h2>Finalités</h2>
      <p>
        Nous utilisons ces données pour créer et sécuriser les comptes, fournir
        les fonctions de facturation, gérer les équipes et invitations, afficher
        les documents que l’utilisateur choisit de partager, répondre aux
        demandes d’assistance et maintenir le service. Facturo ne vend pas les
        données personnelles et n’utilise pas les données de facturation à des
        fins publicitaires.
      </p>

      <h2>Partage et hébergement</h2>
      <p>
        Le service s’appuie sur Supabase pour l’authentification, la base de
        données et le stockage, et sur Vercel pour l’hébergement de
        l’application. Ces prestataires traitent les données pour fournir leurs
        services. Selon la configuration de l’hébergement, les données peuvent
        être traitées dans un pays autre que la RDC.
      </p>
      <p>
        Si l’utilisateur publie un lien de facture ou de catalogue partagé, les
        informations incluses dans ce document deviennent accessibles aux
        personnes disposant du lien, jusqu’à sa révocation ou sa désactivation.
        L’utilisateur est responsable des informations qu’il choisit de
        partager.
      </p>

      <h2>Cookies</h2>
      <p>
        Facturo utilise des cookies techniques nécessaires à l’authentification
        et au maintien de la session. Ils ne servent pas à la publicité. Le
        blocage de ces cookies peut empêcher la connexion ou certaines fonctions
        du service.
      </p>

      <h2>Conservation et suppression</h2>
      <p>
        Les données sont conservées pendant l’utilisation du compte et aussi
        longtemps que nécessaire pour fournir le service. Une demande de
        suppression peut être adressée à l’e-mail de contact ci-dessus ; nous
        pourrons vérifier l’identité du demandeur avant d’agir. Les données
        seront supprimées ou rendues inaccessibles dans un délai raisonnable,
        sous réserve des obligations légales applicables et des sauvegardes
        techniques à purger selon leur cycle normal.
      </p>

      <h2>Vos choix et vos droits</h2>
      <p>
        Vous pouvez demander l’accès à vos données, leur rectification ou leur
        suppression, et vous opposer à certains traitements lorsque la
        législation applicable le prévoit. Contactez-nous à l’adresse indiquée
        plus haut. Vous pouvez également gérer les autorisations accordées à
        Google ou Facebook depuis les paramètres de ces fournisseurs.
      </p>

      <h2>Mises à jour</h2>
      <p>
        Cette politique pourra être mise à jour si Facturo ou les règles
        applicables évoluent. La date de mise à jour figurant en haut de page
        sera alors modifiée.
      </p>
    </LegalDocument>
  );
}
