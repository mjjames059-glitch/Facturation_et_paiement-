# Reprise Facturo — 21 octobre 2026

## Où nous nous sommes arrêtés

Le problème observé était le retour OAuth Google vers `status=profile` : Supabase authentifiait le compte, mais Facturo ne trouvait pas de profil d’entreprise.

L’utilisateur souhaite que Google fournisse uniquement les informations personnelles (nom et e-mail), et que les renseignements de l’entreprise soient saisis explicitement pendant l’inscription.

## Modifications envoyées

- Commit poussé sur `main` : `515f14e` — `Require explicit Facturo registration after Google OAuth`.
- La compilation `npm.cmd run build` passe.
- Le callback OAuth envoie un utilisateur sans profil vers `/auth/sign-up?mode=google`.
- La page d’inscription propose un bouton Google et un formulaire de finalisation qui préremplit le nom et l’e-mail, puis demande les renseignements de l’entreprise.
- L’inscription e-mail et le parcours des invitations d’équipe restent pris en charge.
- Une migration remplace le déclencheur pour qu’un utilisateur OAuth sans métadonnées d’entreprise n’obtienne pas automatiquement une entreprise/profil Facturo. Elle ajoute le RPC authentifié `complete_oauth_registration` pour créer explicitement son espace.

## À faire en premier à la reprise

1. Vérifier que le déploiement Vercel du commit `515f14e` est **Ready**.
2. Dans le projet Supabase `ksntjhxnfmnlxipnldcb`, ouvrir **SQL Editor** et exécuter le fichier `supabase/migrations/20261021020000_explicit_google_registration.sql`.
3. Retester Google depuis un seul domaine Facturo et vérifier que l’utilisateur sans profil arrive au formulaire d’inscription, puis au tableau de bord après validation.
4. Si le RPC échoue, inspecter l’erreur SQL et les journaux Vercel. Le build ne valide pas l’application de la migration à la base distante.

## Limite à expliquer

Le flux OAuth Supabase peut quand même créer l’identité dans `auth.users` lors d’une première connexion Google. Le changement évite de créer automatiquement un profil et une entreprise Facturo; ces derniers n’apparaissent qu’après validation du formulaire d’inscription.
