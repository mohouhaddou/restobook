/**
 * Liste les voix disponibles pour la narration — récupérées dynamiquement depuis le backend
 * (GET /api/narration/voices?lang=), JAMAIS codées en dur ici : le backend interroge lui-même le
 * provider qui sera RÉELLEMENT utilisé pour la langue demandée (voir ProviderManager.js —
 * Kokoro pour l'anglais aujourd'hui, Piper pour le français/l'arabe), donc la liste affichée est
 * toujours cohérente avec ce qui sera effectivement synthétisé. Repli sur les voix du navigateur
 * (SpeechSynthesisFallbackProvider.ts) uniquement si le serveur ne répond pas ou ne connaît
 * aucune voix pour cette langue.
 */
import { API } from '../../../../../../shared/services/api';

export type VoiceGender = 'male' | 'female';

export interface NarrationVoice {
  readonly id: string;
  readonly label: string;
  readonly gender: VoiceGender;
  readonly origin: 'server' | 'browser';
  readonly providerId?: string;
  readonly browserVoice?: SpeechSynthesisVoice;
}

function normalizeGender(gender: unknown): VoiceGender {
  return gender === 'male' ? 'male' : 'female';
}

const serverVoicesCache = new Map<string, Promise<NarrationVoice[]>>();

/** Voix serveur pour une langue — un seul appel réseau par langue (mis en cache en mémoire pour
 * la durée de la session, comme fetchServerStatus dans ProviderManager.ts). */
export function fetchServerVoices(language: string): Promise<NarrationVoice[]> {
  let pending = serverVoicesCache.get(language);
  if (!pending) {
    pending = fetch(API(`/narration/voices?lang=${encodeURIComponent(language)}`))
      .then(res => (res.ok ? res.json() : { voices: [] }))
      .then(data => (Array.isArray(data?.voices) ? data.voices : []).map((v: { id: string; label: string; gender: unknown; providerId?: string }) => ({
        id: v.id,
        label: v.label,
        gender: normalizeGender(v.gender),
        origin: 'server' as const,
        providerId: v.providerId,
      })))
      .catch(() => []);
    serverVoicesCache.set(language, pending);
  }
  return pending;
}

export function resetServerVoicesCache(): void {
  serverVoicesCache.clear();
}

/** Retourne uniquement les voix Piper fournies par le serveur. */
export async function listAvailableVoices(language: string): Promise<NarrationVoice[]> {
  return fetchServerVoices(language);
}
