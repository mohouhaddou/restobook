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
