# Installation — Kokoro TTS

## Dépendance

```bash
cd backend && npm install kokoro-js
```

`kokoro-js` embarque `@huggingface/transformers` (ONNX Runtime pour Node, backend `cpu`) et
`phonemizer` (eSpeak NG en WebAssembly). Aucune dépendance Python.

## Installation du modèle

Le modèle ONNX (~92 Mo, dtype `q8`) n'est **pas** livré avec le paquet npm — il se télécharge au
premier chargement. Pour l'installer explicitement (recommandé en déploiement, pour ne pas payer
ce téléchargement au premier visiteur) :

```bash
cd backend
npm run kokoro:install
```

Ce script (`backend/src/modules/narration/KokoroInstaller.js`) est **idempotent** : s'il détecte
que le modèle est déjà présent (`backend/models/kokoro/`), il ne retélécharge rien.

### Pourquoi `backend/models/kokoro/` et pas le cache par défaut

Par défaut, `@huggingface/transformers` mettrait le modèle en cache **dans
`node_modules/@huggingface/transformers/.cache/`** — un répertoire recréé (donc vidé) à chaque
`npm install`. Le modèle serait alors retéléchargé à chaque déploiement.
`backend/src/modules/narration/KokoroConfig.js` redirige ce cache vers `backend/models/kokoro/`,
au même niveau que `backend/models/piper/` (convention déjà en place) :

```js
const { env: transformersEnv } = require('@huggingface/transformers');
transformersEnv.cacheDir = `${config.CACHE_DIR}${path.sep}`;
```

**Point d'attention vérifié en conditions réelles** : cette affectation doit se faire **avant** le
premier `require('kokoro-js')` du process (donc en haut de `KokoroProvider.js`, à l'exécution du
module, pas à l'intérieur d'une fonction appelée plus tard) — sans quoi le chemin de cache par
défaut est déjà figé pour les téléchargements internes et la redirection ne fait plus rien.

## Vérification de santé

```bash
cd backend
npm run kokoro:health
```

Exécute `backend/src/modules/narration/KokoroHealth.js` : vérifie la présence du modèle, son
chargement réel en mémoire, et une synthèse réelle d'un texte court produisant un fichier WAV
valide. Sortie JSON + code de sortie non-nul en cas d'échec (utilisable en CI/monitoring).

```json
{
  "modelPresent": true,
  "modelLoads": true,
  "synthesizes": true,
  "errors": []
}
```

## Piper (inchangé)

Piper reste installé comme précédemment (`backend/vendor/piper/`, `backend/models/piper/`) — ce
chantier n'a rien changé à son installation, seulement à son rôle dans l'ordre de priorité (voir
`docs/Providers.md`) et à la résolution de sa voix par défaut (désormais PAR langue, voir
`docs/Architecture.md`).

## Sherpa-ONNX / Coqui XTTS

Toujours non installés — interfaces prêtes (`isAvailable()` renvoie `false`). Les activer un jour
ne demandera qu'un `synthesize()` réel dans leur fichier respectif, sans toucher au reste.

## Cache audio existant

Le cache disque des clips déjà synthétisés (`backend/uploads/narration-cache/`) **n'a pas besoin
d'être vidé manuellement** : la clé de cache a été versionnée (`CACHE_VERSION = 'v2'` dans
`cache.js`), donc tout ancien fichier généré par Piper avant ce chantier devient naturellement
introuvable par les nouvelles clés — il reste sur disque (orphelin, sans risque) mais n'est plus
jamais servi par erreur à la place d'un clip Kokoro.
