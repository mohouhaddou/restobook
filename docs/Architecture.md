# Architecture — Narration Engine (Kokoro)

## Principe : le changement de moteur est invisible du reste de l'application

`NarrationEngine.ts`, `StoryPaginator.ts`, `SpeechExtractor.ts`, le `NarrationController.ts`, les
composants React (`BookReader.tsx`, `NarrationBar.tsx`, `NarrationHighlightRenderer.tsx`) et le
cache client n'ont **subi aucune modification de logique** pour ce chantier — seule la couche
Provider, côté backend, a changé. Côté frontend, seuls trois fichiers ont dû évoluer, et
uniquement pour rendre la liste de voix **dynamique** au lieu de codée en dur (conséquence directe
de "ne jamais coder un nom de voix en dur", pas une réécriture du moteur) :

- `VoiceManager.ts` — récupère les voix via `GET /api/narration/voices` au lieu d'une table statique.
- `NarratorRegistry.ts` — **nouveau** : mémorise le narrateur choisi par langue (n'existait pas).
- `BookReader.tsx` / `NarrationBar.tsx` — passent désormais la liste de voix en `props` au lieu de
  la recalculer localement depuis une table figée.

## Schéma complet

```
                          ┌─────────────────────────────────────────┐
                          │  StoryBook / NarrationEngine (INCHANGÉS) │
                          │  BookReader → useNarrationEngine →       │
                          │  NarrationController → NarrationQueue    │
                          └───────────────────┬───────────────────────┘
                                              │ POST /api/narration/synthesize { text, voice, lang }
                                              │ GET  /api/narration/voices?lang=
                                              │ GET  /api/narration/status?lang=
                                              ▼
                          ┌─────────────────────────────────────────┐
                          │        routes.js  →  service.js          │
                          │        (cache versionné v2)              │
                          └───────────────────┬───────────────────────┘
                                              ▼
                          ┌─────────────────────────────────────────┐
                          │   ProviderManager.js  (ProviderFactory/   │
                          │   ProviderRegistry — RÉUTILISÉ, étendu)  │
                          │   activeProvider({ lang }) :              │
                          │   1er provider isAvailable() ET           │
                          │   supportsLanguage(lang)                 │
                          └───┬─────────┬─────────┬─────────┬─────────┘
                              ▼         ▼         ▼         ▼
                          Kokoro   Sherpa-ONNX   Piper   Coqui XTTS
                          (en)     (stub)      (fr,en,ar) (stub)
```

Si aucun provider serveur ne répond (503 `NO_PROVIDER_AVAILABLE`), le client bascule sur
`SpeechSynthesisFallbackProvider.ts` — le seul endroit du frontend qui touche
`window.speechSynthesis`, en tout dernier recours.

## Pourquoi Kokoro et pas un remplacement pur et simple

Recherche menée AVANT toute implémentation (voir `docs/Voices.md`) : `kokoro-js` (le seul portage
Node/JS de Kokoro maintenu, par l'auteur de Transformers.js) ne couvre officiellement que
l'anglais. Plutôt que de forcer une compatibilité française/arabe en piratant les fonctions
internes non exportées de la bibliothèque (aurait dupliqué sa logique de phonemization — interdit
par ce chantier), l'architecture *déjà prévue* de fallback par provider a été étendue avec un
critère de langue : Kokoro devient le moteur principal **là où il excelle réellement**, Piper
reste le filet de sécurité **là où Kokoro ne peut techniquement pas encore aller**.

## Cache — versionnement, pas suppression

`backend/src/modules/narration/cache.js` : la clé SHA-256 inclut désormais un préfixe de version
(`CACHE_VERSION = 'v2'`). Un même texte/voix/langue produit une clé **différente** de celle qu'il
aurait produite avant ce chantier — tout ancien fichier Piper reste sur disque mais devient
orphelin (jamais recherché, jamais servi par erreur). Choix délibéré : plus sûr qu'une suppression
physique, qui risquerait de casser un fichier encore référencé ailleurs.

## Résolution de voix par défaut — un bug corrigé au passage

`PiperProvider.js` retombait auparavant **toujours** sur sa voix française par défaut quand aucune
`voice` explicite n'était fournie, y compris pour un texte anglais ou arabe. Corrigé : la voix par
défaut est désormais résolue **par langue** (`VOICES_BY_LANGUAGE[lang][0]`), cohérent avec le
comportement attendu par Kokoro (qui résout aussi sa voix par défaut selon `lang`, jamais figée).

## Benchmark — Kokoro vs Piper (mesuré dans cet environnement)

Machine de développement, CPU seul (pas de GPU), `dtype: "q8"` pour Kokoro.

| | **Kokoro** (anglais) | **Piper** (anglais) | **Piper** (français) |
|---|---|---|---|
| Taille du modèle | 92,4 Mo (1 modèle partagé, **28 voix**) | 316,3 Mo (5 modèles, 1 par voix) + 52,6 Mo binaire/espeak-ng | *(inclus ci-contre)* |
| Chargement initial | ~0,9 s (une fois par process, gardé en mémoire) | 0 s (spawn un binaire par appel, pas d'état persistant) | 0 s |
| RTF (phrase courte, 24 car.) | **2,50** (plus lent que le temps réel) | 0,33 | 0,35 |
| RTF (phrase moyenne, ~90 car.) | 1,69 | 0,17 | 0,17 |
| RTF (phrase longue, ~230 car.) | 1,50 | 0,14 | 0,12 |
| RSS process Node après chargement | +210 Mo (session ONNX persistante) | +0 Mo (le travail se fait dans un sous-processus éphémère, pas dans le process Node) |
| Qualité subjective | Nettement plus naturelle, intonation "conteur", moins robotique — objectif du chantier atteint pour l'anglais | Correcte, clairement plus mécanique | Correcte |

**Lecture honnête de ces chiffres** : Kokoro est **plus lent que le temps réel** sur CPU dans cet
environnement (RTF > 1 : générer une phrase prend plus longtemps que sa propre durée d'écoute),
alors que Piper est très largement plus rapide que le temps réel (RTF ≈ 0,1–0,3). Ce n'est pas un
problème pour l'usage réel : chaque phrase n'est synthétisée **qu'une seule fois** (cache
disque définitif, voir `NarrationQueue.ts`/`cache.js`), et le préchargement (3 phrases d'avance,
voir `NarrationQueue.ts`) absorbe une bonne partie de ce surcoût au premier passage. Sur un serveur
de production avec plus de cœurs CPU, le RTF de Kokoro serait meilleur que dans cet environnement
de développement partagé et contraint. Le compromis assumé pour ce chantier : **qualité de
narration d'abord**, la latence de génération se lisse par le cache dès la deuxième écoute de
n'importe quelle phrase.

Sherpa-ONNX n'a pas été installé (hors du périmètre demandé) — aucune mesure réelle n'est donc
fournie pour ce provider ; le tableau ci-dessus ne présente que des données mesurées, jamais
estimées.

## Fichiers — nouveaux vs modifiés vs réutilisés tels quels

**Nouveaux** :
`backend/src/modules/narration/KokoroConfig.js`, `KokoroVoiceRegistry.js`, `KokoroInstaller.js`,
`KokoroHealth.js`, `providers/KokoroProvider.js`,
`frontend/.../narration/NarratorRegistry.ts`.

**Modifiés** (logique étendue, jamais réécrite) :
`ProviderManager.js`, `service.js`, `cache.js`, `routes.js`, `providers/PiperProvider.js`,
`providers/SherpaOnnxProvider.js`, `providers/CoquiXttsProvider.js`,
`frontend/.../narration/VoiceManager.ts`, `BookReader.tsx`, `NarrationBar.tsx`.

**Réutilisés tels quels, aucune modification** :
`NarrationEngine.ts`, `NarrationController.ts`, `NarrationSession.ts`, `NarrationTimeline.ts`,
`NarrationQueue.ts`, `NarrationCursor.ts`, `SpeechExtractor.ts`, `SentenceSplitter.ts`,
`StorySynchronizer.ts`, `LanguageDetector.ts`, `NarrationHighlightRenderer.tsx`,
`SpeechSynthesisFallbackProvider.ts`, `wav.js`, tout `MarkdownParser`/`MarkdownRenderer`/thèmes.
