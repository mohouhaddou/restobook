# Configuration Google OAuth (Google Identity Services)

Procédure pour activer "Continuer avec Google" sur iFilino (login/inscription
consommateur et professionnel).

## 1. Créer le client OAuth dans Google Cloud Console

1. Aller sur https://console.cloud.google.com/ et sélectionner (ou créer) un projet.
2. **APIs & Services → OAuth consent screen**
   - Type d'utilisateur : *External*.
   - Nom de l'app : `iFilino`, logo, email support, domaines autorisés (`ifilino.com`).
   - Scopes : garder les scopes par défaut (`openid`, `email`, `profile`) — aucun
     scope supplémentaire n'est nécessaire.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Type d'application : **Web application**.
   - Nom : `iFilino Web`.
   - *Authorized JavaScript origins* — une entrée par domaine servant le frontend :
     - `https://ifilino.com`
     - `https://app.ifilino.com` (si sous-domaine dédié)
     - `https://pro.ifilino.com` (si sous-domaine dédié)
     - `http://localhost:5173` (dev local Vite)
   - *Authorized redirect URIs* : laisser vide — le flux "Google Identity
     Services" utilisé ici (`id_token` via popup/One Tap) n'a pas besoin de
     redirect URI, contrairement à l'ancien flux OAuth Authorization Code.
4. Copier le **Client ID** généré (format `xxxxxxxx-xxxx.apps.googleusercontent.com`).
   Le **Client Secret** n'est pas utilisé par ce flux (vérification d'ID token
   côté serveur, pas d'échange de code) — inutile de le stocker.

## 2. Variables d'environnement

**Backend** (`backend/.env`) :
```
GOOGLE_CLIENT_ID=xxxxxxxx-xxxx.apps.googleusercontent.com
```

**Frontend** (`frontend/.env.production` ou `.env.local` en dev) :
```
VITE_GOOGLE_CLIENT_ID=xxxxxxxx-xxxx.apps.googleusercontent.com
```

C'est le **même** Client ID des deux côtés. Ce n'est pas un secret (il est
visible dans le JS servi au navigateur) — seule la vérification serveur de
l'ID token protège le système, jamais le frontend seul.

## 3. Migration base de données

Avant de déployer, exécuter une fois sur la base de production :
```bash
cd backend
npm run migrate:google-auth
```
Ajoute `google_id`, `auth_provider`, `last_login_at` sur `users` + index
uniques sur `email` et `google_id`. Idempotent (peut être relancée sans risque).

## 4. Vérification post-déploiement

1. Ouvrir `/account` (login/inscription consommateur) → le bouton "Continuer
   avec Google" doit apparaître sous le formulaire. S'il n'apparaît pas,
   vérifier que `VITE_GOOGLE_CLIENT_ID` est bien défini au moment du build
   (`vite build` lit les `.env` à la compilation, pas au runtime).
2. Se connecter avec un compte Google de test → un nouvel utilisateur
   `role=customer` doit apparaître dans `users` avec `auth_provider=google`.
3. Ouvrir `/login` (espace professionnel) → même bouton avec
   `roleIntent=business_owner` → doit rediriger vers `/pro-register` pour
   compléter l'établissement (email/mot de passe sautés).
4. Vérifier dans la console Google Cloud (**APIs & Services → Credentials**)
   qu'aucune erreur `redirect_uri_mismatch` n'apparaît — sinon compléter la
   liste des *Authorized JavaScript origins* avec le domaine manquant.

## 5. Notes de sécurité

- Le backend vérifie systématiquement l'ID token auprès des serveurs Google
  (`google-auth-library`, signature + audience + expiration) — jamais de
  confiance dans un payload décodé côté client.
- Un email Google non vérifié (`email_verified=false`) est toujours refusé.
- Un compte local existant (email/mot de passe) qui se connecte avec Google
  est automatiquement lié (`google_id` renseigné) sans jamais toucher à son
  mot de passe existant.
- `POST /api/auth/google` est limité à 20 requêtes / 15 min / IP (voir
  `backend/src/app.js` et `backend/index.js`).
