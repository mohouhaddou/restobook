import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchServerStatus, resetServerStatusCache, resolveAudio } from '../ProviderManager';

beforeEach(() => {
  resetServerStatusCache();
  vi.unstubAllGlobals();
});

describe('fetchServerStatus', () => {
  it("renvoie l'état du provider serveur (Piper disponible)", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true, providerId: 'piper', providerLabel: 'Piper (auto-hébergé)' }),
    }));
    const status = await fetchServerStatus();
    expect(status).toEqual({ available: true, providerId: 'piper', providerLabel: 'Piper (auto-hébergé)' });
  });

  it('ne casse jamais si le backend est injoignable : available=false plutôt qu\'une exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const status = await fetchServerStatus();
    expect(status.available).toBe(false);
  });

  it("met en cache l'appel : un seul fetch pour plusieurs appels de la même langue", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true, providerId: 'piper', providerLabel: 'Piper' }) });
    vi.stubGlobal('fetch', fetchMock);
    await fetchServerStatus('fr');
    await fetchServerStatus('fr');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('interroge le backend avec ?lang= — le provider actif dépend de la langue (Kokoro pour "en", Piper pour "fr")', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ available: true, providerId: 'kokoro', providerLabel: 'Kokoro (auto-hébergé)' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ available: true, providerId: 'piper', providerLabel: 'Piper (auto-hébergé)' }) });
    vi.stubGlobal('fetch', fetchMock);

    const enStatus = await fetchServerStatus('en');
    const frStatus = await fetchServerStatus('fr');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('lang=en');
    expect(fetchMock.mock.calls[1][0]).toContain('lang=fr');
    expect(enStatus.providerId).toBe('kokoro');
    expect(frStatus.providerId).toBe('piper');
  });

  it('un appel sans langue interroge /status sans paramètre (statut général)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true, providerId: 'kokoro', providerLabel: 'Kokoro' }) });
    vi.stubGlobal('fetch', fetchMock);
    await fetchServerStatus();
    expect(fetchMock.mock.calls[0][0]).not.toContain('lang=');
  });
});

describe('resolveAudio', () => {
  it('retourne un audio serveur quand le backend répond avec succès', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ audioUrl: '/uploads/narration-cache/abc.wav', durationMs: 1234, cached: false, providerId: 'piper' }),
    }));
    const result = await resolveAudio('Bonjour');
    expect(result).toEqual({ kind: 'audio', url: '/uploads/narration-cache/abc.wav', durationMs: 1234, providerId: 'piper', cached: false });
  });

  it('bascule sur speechSynthesis si le backend répond en erreur HTTP (503 NO_PROVIDER_AVAILABLE)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'no provider' }) }));
    const result = await resolveAudio('Bonjour');
    expect(result).toEqual({ kind: 'speechSynthesis' });
  });

  it('bascule sur speechSynthesis si le réseau échoue (pas de rejet propagé)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const result = await resolveAudio('Bonjour');
    expect(result).toEqual({ kind: 'speechSynthesis' });
  });

  it("bascule sur speechSynthesis si la réponse serveur n'a pas d'audioUrl exploitable", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const result = await resolveAudio('Bonjour');
    expect(result).toEqual({ kind: 'speechSynthesis' });
  });
});
