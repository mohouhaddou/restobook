# Restobook Satisfaction

Module d'analyse de satisfaction client pour restaurants.

## Fonctionnalites

- Avis client global sur une commande.
- Notes par plat via `review.item_ratings`.
- Note restaurant via moyenne des avis d'organisation.
- Analyse IA estimative des commentaires.
- Detection des avis negatifs.
- Resume des problemes frequents.
- Suggestions concretes pour le restaurateur.
- Tableau de bord satisfaction.

## Stockage

Le module etend `reviews`:

- `item_ratings`: notes/commentaires par plat.
- `sentiment`: `positive`, `neutral`, `negative`.
- `sentiment_score`: score 0-100.
- `issue_tags`: themes detectes (`price`, `quality`, `service`, `delay`, `portion`, `packaging`).
- `ai_summary`: sortie d'analyse structuree.
- `analyzed_at`: date d'analyse.

Migration:

```bash
cd /var/www/restobook/backend
npm run migrate:satisfaction
```

## API

Routes protegees par organisation et permission restaurant stats/menu:

- `GET /api/satisfaction/dashboard?from&to`: KPIs, plats apprecies, plaintes recurrentes, avis negatifs, recommandations.
- `GET /api/satisfaction/reviews?from&to`: liste detaillee des avis.
- `POST /api/satisfaction/reviews/:id/analyze`: relance l'analyse d'un avis.

## IA

Service: `backend/services/SatisfactionAIService.js`

Sorties:

- plats les plus apprecies;
- plats a surveiller;
- plaintes recurrentes;
- problemes de prix;
- problemes de qualite;
- problemes de service;
- recommandations concretes.

Le service est pret a etre remplace par un fournisseur LLM, mais fonctionne immediatement avec une analyse locale deterministe.

## Frontend

- Client: la page de suivi commande permet de noter la commande et chaque plat.
- Restaurateur: `/#/satisfaction` affiche le tableau de bord satisfaction.
