# RestoBook

Application de réservation de cantine (menu journalier, panier entrée/plat/dessert/boisson, gestion hebdo, préparation, QR code & reçus PDF).

## Structure
- `backend/` (Node/Express/Sequelize, MySQL)
- `frontend/` (Vite/React)

## Démarrage local
```bash
# backend
cp backend/.env.example backend/.env
npm --prefix backend install
npm --prefix backend run dev

# frontend
cp frontend/.env.example frontend/.env
npm --prefix frontend install
npm --prefix frontend run dev

## iFilino Magazine — generation IA OpenAI

Le moteur de brouillons du module Discover/iFilino Magazine utilise maintenant l'API OpenAI cote backend uniquement. Aucune cle API ne doit etre placee dans le frontend, dans `VITE_*`, dans le code source ou dans un bundle navigateur.

Configuration serveur dans `backend/.env` :

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
```

Apres modification de l'environnement :

1. Installer les dependances backend avec `npm install` dans `backend/`.
2. Redemarrer le backend.
3. Ouvrir le back-office superadmin, puis iFilino Discover > Articles.
4. Cliquer sur `Generer avec l'IA`, puis `Tester OpenAI`.
5. Generer un article : il est toujours cree en brouillon et doit etre relu avant publication.

Le fournisseur actif, le modele et l'etat configure/non configure de la cle sont exposes par des endpoints superadmin proteges. La valeur de la cle n'est jamais renvoyee.
