import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSpeechSynthesisSupported, listBrowserVoices, speakWithFallback, cancelAllFallbackSpeech } from '../SpeechSynthesisFallbackProvider';

class FakeUtterance {
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

const speakMock = vi.fn((utterance: FakeUtterance) => { (speakMock as any).lastUtterance = utterance; });
const cancelMock = vi.fn();
const getVoicesMock = vi.fn(() => [
  { voiceURI: 'fr-1', name: 'French Voice', lang: 'fr-FR' } as SpeechSynthesisVoice,
  { voiceURI: 'en-1', name: 'English Voice', lang: 'en-US' } as SpeechSynthesisVoice,
]);

beforeEach(() => {
  speakMock.mockClear();
  cancelMock.mockClear();
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('speechSynthesis', { speak: speakMock, cancel: cancelMock, getVoices: getVoicesMock });
});

describe('SpeechSynthesisFallbackProvider — dernier recours uniquement', () => {
  it('détecte la disponibilité de speechSynthesis', () => {
    expect(isSpeechSynthesisSupported()).toBe(true);
  });

  it('filtre les voix par langue, avec repli sur toutes les voix si aucune ne correspond', () => {
    expect(listBrowserVoices('fr').map(v => v.voiceURI)).toEqual(['fr-1']);
    expect(listBrowserVoices('de')).toHaveLength(2); // aucune voix "de" => toutes renvoyées
  });

  it('speakWithFallback appelle speechSynthesis.speak et déclenche onEnd via onend', () => {
    const onEnd = vi.fn();
    speakWithFallback('Bonjour', { onEnd });
    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = (speakMock as any).lastUtterance as FakeUtterance;
    utterance.onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('cancel() arrête la synthèse et empêche un onEnd tardif de se déclencher deux fois', () => {
    const onEnd = vi.fn();
    const handle = speakWithFallback('Bonjour', { onEnd });
    handle.cancel();
    expect(cancelMock).toHaveBeenCalledTimes(1);
    const utterance = (speakMock as any).lastUtterance as FakeUtterance;
    utterance.onend?.();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('cancelAllFallbackSpeech() annule toute synthèse en cours', () => {
    cancelAllFallbackSpeech();
    expect(cancelMock).toHaveBeenCalledTimes(1);
  });
});
