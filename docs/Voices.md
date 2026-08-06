# Voix — VoiceRegistry

**Aucun nom de voix n'est codé en dur pour Kokoro.** Le catalogue de voix Kokoro est lu
dynamiquement depuis la bibliothèque elle-même (`backend/src/modules/narration/KokoroVoiceRegistry.js`),
jamais recopié à la main. Pour Piper, les voix sont une liste curée lors de son installation (un
modèle par voix, choisi et téléchargé explicitement) — ce n'est pas la même chose qu'un "nom codé
en dur" au sens interdit par ce chantier : Piper ne peut de toute façon pas exposer un catalogue
dynamique, chaque voix étant un fichier de modèle séparé à installer un par un.

## ⚠️ Limitation vérifiée : Kokoro ne couvre PAS le français (homme) ni l'arabe

Avant d'implémenter quoi que ce soit, une vérification en conditions réelles a été faite (voir
`docs/Architecture.md` pour le détail de la démarche). Résultat, catalogue de voix **réellement
exposé par le paquet `kokoro-js@1.2.1`** (vérifié via `tts.voices` sur une instance chargée) :

| Langue | Voix Kokoro disponibles |
|---|---|
| Anglais (en-us + en-gb) | **28 voix** (11 femmes + 9 hommes américains, 4 femmes + 4 hommes britanniques) |
| Français | **0** |
| Arabe | **0** |

Le modèle Kokoro-82M sous-jacent possède bien un fichier de voix française (`ff_siwis.bin`, visible
sur le dépôt HuggingFace `onnx-community/Kokoro-82M-v1.0-ONNX`), mais **la bibliothèque `kokoro-js`
elle-même refuse toute voix hors de son catalogue anglais codé dans son propre bundle** (`_validate_voice()`
lève une erreur explicite pour toute voix non listée). Contourner cette limitation aurait exigé de
dupliquer la logique interne de phonemization/tokenisation de la bibliothèque (contraire à la
consigne "ne jamais dupliquer une logique déjà présente") — ce chantier respecte donc cette limite
et s'appuie sur le mécanisme de fallback prévu : **le français et l'arabe restent servis par Piper**,
qui reste le seul provider réel pour ces deux langues.

Ce n'est pas un bug de cette implémentation : c'est l'état réel du catalogue public de voix de
Kokoro à la date de ce chantier. À surveiller si une future version de `kokoro-js` élargit son
catalogue.

## Catalogue réel par langue (vérifié en conditions réelles)

| Langue | Provider | Voix (nom réel, genre) |
|---|---|---|
| Anglais | **Kokoro** | 28 voix — meilleures notées : **Heart** (`af_heart`, femme, note A), **Bella** (`af_bella`, femme, note A-), pas de voix homme au-dessus de C+ (`am_fenrir`/`am_michael`/`am_puck`) |
| Français | Piper | **Siwis** (`fr_FR-siwis-medium`, femme), **Tom** (`fr_FR-tom-medium`, homme) |
| Arabe | Piper | **Kareem** (`ar_JO-kareem-medium`, homme) — aucune voix féminine arabe dans le catalogue Piper public à ce jour |

## Comment le registre est construit

- **Kokoro** (`KokoroVoiceRegistry.js`) : lit `ttsInstance.voices` (un getter exposé par kokoro-js
  sur le modèle chargé), normalise `en-us`/`en-gb` → `en`, trie par note de qualité
  (`overallGrade`). Nécessite que le modèle soit chargé (`warmUp()`), donc asynchrone.
- **Piper** (`PiperProvider.js`, `VOICES_BY_LANGUAGE`) : liste curée des modèles réellement
  installés sous `backend/models/piper/` — chaque entrée correspond à un fichier `.onnx` présent.
- **Fusion** (`ProviderManager.listVoices(lang)`) : interroge le provider qui serait *réellement*
  choisi pour cette langue (même logique que `activeProvider({lang})`), jamais une liste
  indépendante qui pourrait afficher une voix non utilisable.

## Côté client

`frontend/.../narration/VoiceManager.ts` ne contient plus aucun nom de voix : il appelle
`GET /api/narration/voices?lang=` et met le résultat en cache par langue (mémoire, durée de la
session). `frontend/.../narration/NarratorRegistry.ts` (nouveau) mémorise le dernier narrateur
choisi par langue dans `localStorage` ; si la voix mémorisée n'existe plus dans le registre actuel
(ex. après ce changement de moteur), `BookReader.tsx` retombe automatiquement sur la meilleure
voix disponible.
