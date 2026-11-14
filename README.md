# Facturo

Facturo est un SaaS de facturation et de suivi des paiements pour les petites et moyennes entreprises. L’interface est en français et conçue d’abord pour téléphone.

## Fonctionnalités

- Inscription et connexion par e-mail/mot de passe ou avec Google et Facebook via Supabase Auth.
- Inscription sociale avec récupération du nom et de l’adresse e-mail, création d’un mot de passe, puis connexion explicite avant l’accès au tableau de bord.
- Profil entreprise, logo et taux de change USD/CDF.
- Gestion des clients et du catalogue de produits et services.
- Factures USD ou CDF, lignes libres ou issues du catalogue, numérotation séquentielle par entreprise.
- Recherche des factures par numéro ou client et filtres par statut.
- Enregistrement manuel des paiements, échéances et relances WhatsApp.
- Liens de facture publics à jeton aléatoire et téléchargement PDF côté serveur.
- Tableau de bord avec conversion USD/CDF et répartition B2B, B2A et B2C.
- Row Level Security sur les tables et le stockage de logos.

Les montants sont stockés en entiers : centimes pour USD et unités entières pour CDF. Le taux de change initial est 2 800 CDF pour 1 USD.

## Prérequis

- Node.js 20.9 ou plus récent.
- npm.
- Un projet Supabase.

Next.js 16 demande Node.js 20.9 ou plus récent. Consultez les [prérequis Next.js](https://nextjs.org/docs/app/getting-started/installation).

## Créer le projet Supabase

1. Créez un projet depuis le [tableau de bord Supabase](https://supabase.com/dashboard).
2. Dans **Project Settings → API Keys**, récupérez l’URL du projet et la clé **Publishable**. Cette clé est publique et peut être utilisée par l’application ; aucune clé `service_role` n’est nécessaire.
3. À la racine du dépôt, liez les migrations au projet :

   ```powershell
   npx supabase login
   npx supabase link --project-ref VOTRE_PROJECT_REF
   npx supabase migration list
   npx supabase db push --dry-run
   npx supabase db push
   ```

   Vérifiez l’historique distant et le résultat du dry-run avant de confirmer l’application. `db push` applique les migrations forward-only du dossier `supabase/migrations` dans l’ordre. Consultez le [guide Supabase des migrations](https://supabase.com/docs/guides/deployment/database-migrations).

4. Dans **Authentication → URL Configuration**, définissez l’URL du site et ajoutez ces URL de redirection :

   - `http://localhost:3000/auth/callback`
   - `https://VOTRE-DOMAINE-VERCEL/auth/callback`

5. Vérifiez que la confirmation par e-mail est activée pour le parcours d’inscription. Après confirmation, l’utilisateur revient à la page de connexion.
6. Dans **Authentication → Sign In / Providers**, activez Google et/ou Facebook et renseignez les identifiants de vos applications. Pour Facebook, autorisez l’accès à l’adresse e-mail et utilisez l’URL de callback Supabase affichée dans la configuration du fournisseur. Facturo demande les permissions `email` et `public_profile`.

Lors d’une inscription avec Google ou Facebook, Facturo récupère le nom et l’adresse e-mail, demande un mot de passe et les renseignements de l’entreprise, puis renvoie l’utilisateur à la page de connexion. Les prochaines connexions peuvent ainsi se faire avec l’adresse e-mail et ce mot de passe.

Le CLI Supabase est lancé avec `npx supabase`; si le CLI n’est pas déjà présent, npm le récupère pour la commande. Pour utiliser l’environnement Supabase local, installez Docker Desktop puis suivez le [guide du CLI Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started).

## Variables d’environnement

Copiez le fichier d’exemple :

```powershell
Copy-Item .env.example .env.local
```

Puis renseignez :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=VOTRE-CLE-PUBLISHABLE
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`NEXT_PUBLIC_APP_URL` doit être l’adresse publique de l’application pour que les e-mails de confirmation reviennent au bon endroit. N’ajoutez jamais de clé secrète dans une variable `NEXT_PUBLIC_*`.

## Lancer l’application

```powershell
npm install
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000), puis créez un compte. L’inscription ajoute l’entreprise, son profil, ses paramètres par défaut et, si l’utilisateur le choisit, son entrée dans la liste d’attente.

Vérifications disponibles :

```powershell
npm run lint
npm run build
```

## Déploiement sur Vercel

1. Importez le dépôt dans [Vercel](https://vercel.com/new).
2. Ajoutez les trois variables de `.env.example` dans les environnements **Production**, **Preview** et, si besoin, **Development**. Pour Production, définissez `NEXT_PUBLIC_APP_URL` sur l’URL HTTPS réellement utilisée.
3. Avant le premier déploiement, liez le CLI Supabase au projet de production et appliquez les migrations avec `npx supabase db push`.
4. Ajoutez `https://VOTRE-DOMAINE-VERCEL/auth/callback` aux URL de redirection de Supabase.
5. Déployez. Vercel détecte Next.js et utilise les scripts `build` et `start` du `package.json`.

## Structure Supabase

- `companies`, `profiles`, `company_memberships` : entreprises (espaces de travail), identités utilisateur et rôles par entreprise. Un utilisateur peut appartenir à plusieurs entreprises.
- `clients`, `catalog_items` : carnet clients et catalogue.
- `invoices`, `invoice_lines`, `payments` : factures, lignes et paiements.
- `settings` : taux de change, identité visuelle, paramètres régionaux et valeurs par défaut des factures.
- `subscription_plans`, `company_subscriptions` : forfaits, droits d’accès et abonnements par entreprise. Les entreprises existantes conservent le forfait de compatibilité illimité ; les nouvelles entreprises démarrent avec un essai de 30 jours. Aucun fournisseur de paiement n’est configuré.
- `platform_admins`, `platform_audit_events` : autorisation explicite des administrateurs Facturo et journal des actions sensibles.
- `waitlist_dgi` : inscriptions volontaires à la liste d’attente.
- `src/lib/fiscal/provider.ts` : interface d’extension et adaptateur `none`.

Les factures sont créées par une fonction SQL transactionnelle : l’incrément du numéro est annulé si la création échoue. Les brouillons ne sont pas accessibles par leur lien public. Les routes `/f/[token]` et `/f/[token]/pdf` n’exposent que les factures envoyées ou payées.

### Initialiser l’administration Facturo

Après application des migrations, créez un compte utilisateur normal, puis récupérez son **UUID Auth** dans **Supabase → Authentication → Users**. Dans le SQL Editor Supabase, accordez explicitement le rôle plateforme avec cet UUID :

```sql
insert into public.platform_admins (user_id)
values ('REMPLACER-PAR-UUID-AUTH'::uuid)
on conflict (user_id) do update set is_active = true;
```

Cette opération manuelle est requise pour le premier administrateur. Les rôles d’équipe ou une adresse e-mail publique ne donnent jamais accès à `/admin`. N’exposez pas la clé `service_role` dans l’application ; les variables d’environnement client nécessaires sont uniquement `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `NEXT_PUBLIC_APP_URL`.

L’espace d’administration `/admin` permet de rechercher les entreprises, filtrer par forfait ou statut, consulter les usages et modifier un forfait ou un statut. Ces modifications sont vérifiées côté serveur et consignées dans `platform_audit_events`.
