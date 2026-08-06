# Audit i18n des chaînes statiques

Généré le : 2026-07-26T19:39:26.389Z

## Périmètre

- Inclus : `frontend/src/**/*.{js,jsx,ts,tsx}`
- Exclus : `frontend/src/pages/discover/**`, `frontend/src/**/discover/**`, `backend/src/modules/discover/**`

## Résumé qualifié

- Occurrences brutes qualifiées : 27477
- Textes visibles probables : 1263
- Contenus dynamiques : 1128
- Valeurs techniques : 21326
- Textes de développement : 1133
- À vérifier manuellement : 2627
- Fichiers avec textes visibles probables : 128

## Modules les plus concernés

| Module | Total | Visible | Dynamique | Technique | Dev | À vérifier |
|---|---:|---:|---:|---:|---:|---:|
| pages | 9133 | 517 | 417 | 7295 | 152 | 752 |
| shared | 3250 | 277 | 121 | 2191 | 181 | 480 |
| modules | 4692 | 133 | 115 | 3328 | 641 | 475 |
| superadmin | 1638 | 105 | 109 | 1321 | 12 | 91 |
| pharmacy | 2115 | 58 | 91 | 1792 | 39 | 135 |
| config | 151 | 54 | 4 | 77 | 8 | 8 |
| customer-dashboard | 957 | 34 | 34 | 800 | 14 | 75 |
| infra | 453 | 32 | 43 | 354 | 3 | 21 |
| hanout | 1639 | 26 | 77 | 1384 | 51 | 101 |
| marketplace | 1378 | 12 | 56 | 1100 | 8 | 202 |
| pos | 417 | 11 | 21 | 332 | 1 | 52 |
| i18n | 135 | 2 | 10 | 121 | 1 | 1 |
| orders | 1018 | 2 | 20 | 794 | 13 | 189 |
| App.jsx | 53 | 0 | 0 | 46 | 3 | 4 |
| entry-server.jsx | 19 | 0 | 1 | 15 | 3 | 0 |

## Notes

- La classification est heuristique : `visible_static` et `manual_review` sont les files prioritaires à traiter.
- Les contenus dynamiques ne doivent pas être remplacés par des clés statiques ; ils alimenteront une future phase de contenu multilingue en base.
- Le rapport JSON contient chaque occurrence avec fichier, ligne, extrait, module, priorité, confiance et état de migration.
