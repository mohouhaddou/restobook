/**
 * Précharge et met en cache (côté client, en mémoire) l'audio résolu pour les prochaines phrases,
 * pour une lecture SANS coupure : au moment où le NarrationController a besoin du clip suivant, il
 * est déjà résolu (voire déjà en cours de chargement réseau) plutôt que demandé à la volée.
 * Ne joue rien elle-même — ça, c'est le rôle de NarrationController.ts.
 */
import type { SentenceCue } from './SpeechExtractor';
import { resolveAudio, type ResolvedAudio, type ResolveAudioOptions } from './ProviderManager';

const DEFAULT_PRELOAD_AHEAD = 3;

function cacheKeyFor(cue: SentenceCue, options: ResolveAudioOptions): string {
  return `${options.lang || 'fr'}::${options.voice || 'default'}::${cue.text}`;
}

export interface NarrationQueue {
  /** Résout l'audio d'un cue (cache-first) — jamais deux requêtes réseau pour le même texte. */
  resolve(cue: SentenceCue): Promise<ResolvedAudio>;
  /** Déclenche la résolution des N prochains cues `sentence` sans attendre leur résultat. */
  preloadAhead(cues: readonly SentenceCue[], count?: number): void;
  clear(): void;
}

export function createNarrationQueue(options: ResolveAudioOptions = {}): NarrationQueue {
  const cache = new Map<string, Promise<ResolvedAudio>>();

  function resolve(cue: SentenceCue): Promise<ResolvedAudio> {
    const key = cacheKeyFor(cue, options);
    let pending = cache.get(key);
    if (!pending) {
      pending = resolveAudio(cue.text, options);
      cache.set(key, pending);
    }
    return pending;
  }

  function preloadAhead(cues: readonly SentenceCue[], count = DEFAULT_PRELOAD_AHEAD): void {
    for (const cue of cues.slice(0, count)) {
      resolve(cue).catch(() => {}); // le préchargement ne doit jamais faire échouer l'appelant
    }
  }

  function clear(): void {
    cache.clear();
  }

  return { resolve, preloadAhead, clear };
}
