# Facturo

Facturo est un SaaS de facturation et de suivi des paiements pour les petites et moyennes entreprises. L’interface est en français et conçue d’abord pour téléphone.

## Fonctionnalités

- Inscription et connexion par e-mail avec Supabase Auth.
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
   npx supabase db push --dry-run
   npx supabase db push
   ```

   La commande `db push` applique les migrations du dossier `supabase/migrations` dans l’ordre. Elle crée les tables, les politiques RLS, les fonctions de numérotation et de partage, ainsi que le bucket de logos. Consultez le [guide Supabase des migrations](https://supabase.com/docs/guides/deployment/database-migrations).

4. Dans **Authentication → URL Configuration**, définissez l’URL du site et ajoutez ces URL de redirection :

   - `http://localhost:3000/auth/callback`
   - `https://VOTRE-DOMAINE-VERCEL/auth/callback`

5. Vérifiez que la confirmation par e-mail est activée pour le parcours d’inscription. Le lien de confirmation revient sur `/auth/callback`.

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

- `companies`, `profiles` : entreprise et propriétaire du compte.
- `clients`, `catalog_items` : carnet clients et catalogue.
- `invoices`, `invoice_lines`, `payments` : factures, lignes et paiements.
- `settings` : taux de change.
- `waitlist_dgi` : inscriptions volontaires à la liste d’attente.
- `src/lib/fiscal/provider.ts` : interface d’extension et adaptateur `none`.

Les factures sont créées par une fonction SQL transactionnelle : l’incrément du numéro est annulé si la création échoue. Les brouillons ne sont pas accessibles par leur lien public. Les routes `/f/[token]` et `/f/[token]/pdf` n’exposent que les factures envoyées ou payées.
