# Providers TTS — ProviderManager

## Le ProviderFactory/ProviderRegistry existait déjà

Avant ce chantier, `backend/src/modules/narration/ProviderManager.js` remplissait déjà exactement
le rôle d'un ProviderFactory/ProviderRegistry : un tableau ordonné de providers, chacun exposant
`{ id, label, isAvailable(), synthesize() }`, et une fonction `synthesize()` qui choisit le
premier provider disponible sans qu'aucun autre composant (NarrationEngine, StoryBook, service
HTTP) n'ait à connaître le moteur réellement utilisé.

**Décision** : réutiliser ce module plutôt que d'en créer un second (`shared/tts/ProviderFactory.ts`
aurait dupliqué exactement cette logique — contraire à la consigne du chantier). Seuls des fichiers
réellement nouveaux ont été ajoutés (KokoroProvider, KokoroConfig, KokoroVoiceRegistry, KokoroInstaller,
KokoroHealth), tous sous `backend/src/modules/narration/`, aux côtés des providers existants.

## Ordre de priorité (mis à jour)

```
1. Kokoro       — moteur principal, qualité de référence
2. Sherpa-ONNX  — fallback, NON installé (interface prête, isAvailable() = false)
3. Piper        — fallback réel : SEUL provider couvrant le français et l'arabe aujourd'hui,
                  et filet de sécurité anglais si Kokoro venait à manquer
4. Coqui XTTS   — dernier fallback serveur, NON installé (interface prête)
──────────────────────────────────────────────────────────────────────────
(client) SpeechSynthesis — navigateur, UNIQUEMENT si aucun provider serveur ne répond
```

`window.speechSynthesis` n'apparaît JAMAIS côté serveur — seul
`frontend/.../narration/SpeechSynthesisFallbackProvider.ts` y touche, en tout dernier recours.

## Sélection PAR LANGUE (le vrai changement de ce chantier)

Avant : `activeProvider()` renvoyait simplement le premier provider `isAvailable()`, sans savoir
si ce provider couvrait la langue demandée. Depuis ce chantier, chaque provider expose aussi
`supportsLanguage(lang)`, et la sélection combine les deux conditions :

```js
function activeProvider({ lang } = {}) {
  return PROVIDERS.find(p => p.isAvailable() && providerSupportsLanguage(p, lang)) || null;
}
```

C'est ce test à deux conditions qui fait que **Kokoro ne pilote que l'anglais** (aujourd'hui la
seule langue où il expose des voix — voir `docs/Voices.md`) et que **le français/l'arabe basculent
automatiquement vers Piper**, sans qu'aucun autre composant n'ait à connaître cette règle. Ce n'est
pas une panne : c'est le mécanisme de fallback explicitement demandé pour ce chantier.

| Langue | Provider réellement utilisé | Pourquoi |
|---|---|---|
| `en` | **Kokoro** | Seule langue où kokoro-js expose des voix |
| `fr` | Piper | Kokoro n'a qu'une voix française dans son dépôt de modèles (`ff_siwis`) mais elle n'est **pas exposée par la bibliothèque `kokoro-js`** (voir Voices.md) |
| `ar` | Piper | Aucune voix arabe dans kokoro-js |

## `GET /api/narration/voices?lang=`

Interroge `ProviderManager.listVoices(lang)`, qui appelle **le provider qui serait réellement
choisi** pour cette langue et lui demande sa propre liste de voix (`provider.listVoices(lang)`).
Garantit que la liste affichée côté client correspond toujours exactement à ce qui sera utilisé —
jamais une liste indépendante qui pourrait promettre une voix non disponible.

## `GET /api/narration/status?lang=`

Renvoie le provider actif pour une langue (ou le premier disponible tout court si `lang` omis) —
sert au client à savoir s'il doit basculer sur son propre repli `SpeechSynthesis`.

## Fichiers

```
backend/src/modules/narration/
├── ProviderManager.js          (réutilisé, étendu : ordre + sélection par langue)
├── service.js                  (modifié : transmet `lang` au provider)
├── cache.js                    (modifié : clé versionnée, voir Architecture.md)
├── routes.js                   (modifié : /status accepte ?lang=, nouveau /voices)
├── KokoroConfig.js              (nouveau)
├── KokoroVoiceRegistry.js       (nouveau)
├── KokoroInstaller.js           (nouveau)
├── KokoroHealth.js              (nouveau)
└── providers/
    ├── KokoroProvider.js         (nouveau)
    ├── PiperProvider.js          (modifié : supportsLanguage/listVoices, voix par défaut PAR langue)
    ├── SherpaOnnxProvider.js     (modifié : supportsLanguage/listVoices ajoutés au stub)
    └── CoquiXttsProvider.js      (modifié : idem)
```
