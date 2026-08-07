/**
 * SEUL fichier du Narration Engine autorisé à toucher window.speechSynthesis /
 * SpeechSynthesisUtterance — dernier filet de secours, jamais le moteur principal (voir
 * ProviderManager.ts : n'est utilisé que si le backend ne renvoie aucun provider serveur, ex.
 * Piper indisponible). INTERDICTION explicite de généraliser cette API ailleurs dans le moteur.
 */

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function listBrowserVoices(language: string): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  const all = window.speechSynthesis.getVoices();
  const matching = all.filter(v => v.lang.toLowerCase().startsWith(language));
  return matching.length ? matching : all;
}

export interface FallbackSpeakOptions {
  readonly rate?: number;
  readonly voice?: SpeechSynthesisVoice | null;
  readonly onEnd: () => void;
  readonly onError?: (message: string) => void;
}

export interface FallbackHandle {
  cancel(): void;
}

/** Lit une phrase via la voix système — durée inconnue à l'avance, on attend `onEnd`. */
export function speakWithFallback(text: string, { rate = 1, voice = null, onEnd, onError }: FallbackSpeakOptions): FallbackHandle {
  if (!isSpeechSynthesisSupported()) {
    onError?.('speechSynthesis indisponible dans ce navigateur');
    onEnd();
    return { cancel: () => {} };
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  if (voice) utterance.voice = voice;
  let cancelled = false;
  utterance.onend = () => { if (!cancelled) onEnd(); };
  utterance.onerror = () => { if (!cancelled) { onError?.('Erreur de synthèse speechSynthesis'); onEnd(); } };
  window.speechSynthesis.speak(utterance);
  return {
    cancel: () => { cancelled = true; window.speechSynthesis.cancel(); },
  };
}

export function cancelAllFallbackSpeech(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
