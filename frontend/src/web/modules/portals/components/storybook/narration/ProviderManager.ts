/** Résout exclusivement les audios produits par Piper côté serveur. */
import { API } from '../../../../../../shared/services/api';

export interface ServerStatus {
  readonly available: boolean;
  readonly providerId: string | null;
  readonly providerLabel: string | null;
}

export type ResolvedAudio =
  | { readonly kind: 'audio'; readonly url: string; readonly durationMs: number; readonly providerId: string; readonly cached: boolean }
  | { readonly kind: 'error'; readonly message: string };

const statusCache = new Map<string, Promise<ServerStatus>>();

/** Interroge /api/narration/status pour une langue donnée (mis en cache en mémoire, une requête
 * par langue par session) — n'affecte jamais un appel de synthèse individuel, juste l'indicateur
 * affiché par NarrationBar. Le provider actif dépend de la langue (voir ProviderManager.js côté
 * backend : Kokoro pour l'anglais, Piper pour le français/l'arabe) — un appel sans langue
 * renverrait toujours le premier provider disponible tout court (Kokoro), jamais celui
 * réellement utilisé pour l'histoire en cours. */
export function fetchServerStatus(language?: string): Promise<ServerStatus> {
  const key = language || '';
  let pending = statusCache.get(key);
  if (!pending) {
    const query = language ? `?lang=${encodeURIComponent(language)}` : '';
    pending = fetch(API(`/narration/status${query}`))
      .then(res => (res.ok ? res.json() : { available: false, providerId: null, providerLabel: null }))
      .catch(() => ({ available: false, providerId: null, providerLabel: null }));
    statusCache.set(key, pending);
  }
  return pending;
}

export function resetServerStatusCache(): void {
  statusCache.clear();
}

export interface ResolveAudioOptions {
  readonly voice?: string;
  readonly lang?: string;
}

/** Résout une phrase via Piper. Aucun repli sur la synthèse vocale du navigateur. */
export async function resolveAudio(text: string, options: ResolveAudioOptions = {}): Promise<ResolvedAudio> {
  try {
    const res = await fetch(API('/narration/synthesize'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: options.voice, lang: options.lang }),
    });
    if (!res.ok) return { kind: 'error', message: "Piper indisponible (HTTP " + res.status + ")" };
    const data = await res.json();
    if (!data?.audioUrl) return { kind: 'error', message: 'Piper n’a retourné aucun audio' };
    return {
      kind: 'audio',
      url: data.audioUrl,
      durationMs: Number(data.durationMs) || 0,
      providerId: data.providerId || 'unknown',
      cached: Boolean(data.cached),
    };
  } catch {
    return { kind: 'error', message: 'Impossible de joindre Piper' };
  }
}
