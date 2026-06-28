# Restobook AI Nutrition

Module d'estimation nutritionnelle des plats du catalogue Restobook.

## Objectif

Permettre a un utilisateur autorise d'obtenir une estimation nutritionnelle d'un plat:

- calories estimees;
- proteines;
- glucides;
- lipides;
- allergenes potentiels;
- score sante simple sur 100;
- recommandation selon un objectif utilisateur.

Les resultats sont indicatifs et ne remplacent jamais un avis medical ou nutritionnel professionnel.

## Objectifs utilisateur

- `weight_loss`: perte de poids.
- `muscle_gain`: prise de muscle.
- `balanced`: alimentation equilibree.
- `light_meal`: repas leger.
- `diabetes_or_restriction`: diabete ou restriction alimentaire.

## Backend

Service: `backend/services/AIService.js`

Le service expose:

- `buildNutritionPrompt({ dish, goal })`: structure de prompt IA reutilisable avec un fournisseur LLM.
- `estimateDishNutrition({ dish, goal })`: estimation locale normalisee, operationnelle sans cle API externe.

Route: `/api/nutrition`

- `GET /items`: liste les plats et leurs donnees nutritionnelles stockees.
- `GET /items/:id`: detail nutritionnel d'un plat.
- `POST /items/:id/analyze`: genere et stocke une estimation pour un objectif donne.

Permission requise: `ai.nutrition.analyze`.

## Stockage

Les resultats sont stockes sur `menu_items`:

- `calories`
- `proteines_g`
- `glucides_g`
- `lipides_g`
- `allergenes`
- `health_score`
- `nutrition_analysis`
- `nutrition_analyzed_at`

Migration:

```bash
cd /var/www/restobook/backend
npm run migrate:nutrition
```

## Frontend

Page: `/#/nutrition-ai`

Comportement:

- choix de l'objectif nutritionnel;
- selection d'un plat du catalogue;
- lancement de l'analyse;
- affichage des calories, macros, allergenes, score sante et recommandation;
- message visible indiquant que les resultats sont estimatifs.

## Limites actuelles

- L'estimation repose sur le nom, type et description du plat.
- Les portions exactes, recettes, marques et quantites ne sont pas connues.
- Le service est pret pour un branchement LLM, mais fonctionne actuellement en estimation locale deterministe.
