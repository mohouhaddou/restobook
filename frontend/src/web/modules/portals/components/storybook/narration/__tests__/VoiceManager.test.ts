import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchServerVoices, resetServerVoicesCache, listFallbackVoices, listAvailableVoices } from '../VoiceManager';

beforeEach(() => {
  resetServerVoicesCache();
  vi.unstubAllGlobals();
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [
      { voiceURI: 'fr-1', name: 'French Voice', lang: 'fr-FR' } as SpeechSynthesisVoice,
      { voiceURI: 'en-1', name: 'English Voice', lang: 'en-US' } as SpeechSynthesisVoice,
    ],
  });
});

describe('fetchServerVoices', () => {
  it("récupère les voix serveur pour une langue (jamais codées en dur, toujours depuis /api/narration/voices)", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voices: [{ id: 'af_heart', label: 'Heart', gender: 'female', providerId: 'kokoro' }] }),
    }));
    const voices = await fetchServerVoices('en');
    expect(voices).toEqual([{ id: 'af_heart', label: 'Heart', gender: 'female', origin: 'server', providerId: 'kokoro' }]);
  });

  it('normalise un genre inconnu/absent sur "female" par défaut', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voices: [{ id: 'x', label: 'X', gender: 'unknown', providerId: 'piper' }] }),
    }));
    const voices = await fetchServerVoices('fr');
    expect(voices[0].gender).toBe('female');
  });

  it('ne casse jamais si le backend est injoignable : liste vide plutôt qu\'une exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const voices = await fetchServerVoices('en');
    expect(voices).toEqual([]);
  });

  it('liste vide si la réponse HTTP est en erreur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    const voices = await fetchServerVoices('ar');
    expect(voices).toEqual([]);
  });

  it("met en cache l'appel par langue : un seul fetch pour plusieurs appels de la même langue", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ voices: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    await fetchServerVoices('en');
    await fetchServerVoices('en');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('un fetch séparé par langue différente', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ voices: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    await fetchServerVoices('en');
    await fetchServerVoices('fr');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('listFallbackVoices', () => {
  it('liste les voix navigateur en repli, filtrées par langue', () => {
    const voices = listFallbackVoices('fr');
    expect(voices).toHaveLength(1);
    expect(voices[0].origin).toBe('browser');
    expect(voices[0].id).toBe('fr-1');
  });
});

describe('listAvailableVoices', () => {
  it('préfère toujours les voix serveur si elles existent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voices: [{ id: 'af_heart', label: 'Heart', gender: 'female', providerId: 'kokoro' }] }),
    }));
    const voices = await listAvailableVoices('en');
    expect(voices.every(v => v.origin === 'server')).toBe(true);
  });

  it('bascule sur les voix navigateur si le serveur ne renvoie rien pour cette langue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ voices: [] }) }));
    const voices = await listAvailableVoices('fr');
    expect(voices.length).toBeGreaterThan(0);
    expect(voices.every(v => v.origin === 'browser')).toBe(true);
  });

  it('bascule sur les voix navigateur si le serveur est injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const voices = await listAvailableVoices('en');
    expect(voices.every(v => v.origin === 'browser')).toBe(true);
  });
});
