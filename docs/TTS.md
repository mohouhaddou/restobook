# Narration Engine — TTS (vue d'ensemble)

iFilino Kids narre ses Stories avec une voix de synthèse auto-hébergée (aucune API IA payante).
Le moteur de narration frontend (`frontend/src/modules/portals/components/storybook/narration/`)
lit l'AST Markdown d'une histoire (jamais le HTML affiché), en extrait des phrases, et demande au
backend de les synthétiser en audio. Le backend choisit lui-même quel moteur TTS utiliser — le
frontend ne connaît jamais le moteur réel.

## Moteur principal : Kokoro

Depuis ce chantier, **Kokoro** (https://github.com/hexgrad/kokoro, Apache-2.0, 82M paramètres)
est le moteur principal — remplace Piper pour toute langue qu'il couvre réellement. Exécuté
localement via [`kokoro-js`](https://www.npmjs.com/package/kokoro-js) (ONNX Runtime, aucun appel
réseau à la synthèse une fois le modèle en cache). Voir `docs/Voices.md` pour le détail des voix
et des langues réellement couvertes, et `docs/Architecture.md` pour le mécanisme de fallback
automatique quand Kokoro ne couvre pas la langue demandée.

## Chaîne complète

```
article.md (backend/src/shared/markdown/markdownEngine.js)
   ↓
Block[] (frontend/src/shared/markdown/MarkdownParser.ts)
   ↓
SpeechExtractor.ts   → ignore les images, découpe en phrases, détecte les dialogues
   ↓
NarrationTimeline.ts → séquence de cues (phrase / dwell)
   ↓
NarrationQueue.ts    → préchargement + cache côté client
   ↓
ProviderManager.ts (client) → POST /api/narration/synthesize
   ↓
backend/src/modules/narration/ProviderManager.js  ←── LE SEUL endroit qui choisit le moteur
   ↓
KokoroProvider → SherpaOnnxProvider → PiperProvider → CoquiXttsProvider (fallback en cascade)
   ↓
NarrationController.ts → lecture continue, jamais interrompue par un tourne-page
```

Voir aussi :
- `docs/Providers.md` — le ProviderManager, l'ordre de priorité, le fallback par langue.
- `docs/Voices.md` — catalogue de voix par langue, comment il est construit dynamiquement.
- `docs/Installation.md` — installer/vérifier Kokoro.
- `docs/Architecture.md` — schéma complet, composants modifiés vs réutilisés.
