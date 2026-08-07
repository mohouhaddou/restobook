import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNarrationQueue } from '../NarrationQueue';
import type { SentenceCue } from '../SpeechExtractor';

function sentence(id: string, text: string): SentenceCue {
  return { type: 'sentence', id, pageIndex: 0, chapter: null, text, dialogue: false };
}

beforeEach(() => { vi.unstubAllGlobals(); });

describe('NarrationQueue', () => {
  it("ne resynthétise jamais deux fois la même phrase : un seul appel réseau pour deux resolve()", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ audioUrl: '/x.wav', durationMs: 1000, cached: false, providerId: 'piper' }) });
    vi.stubGlobal('fetch', fetchMock);
    const queue = createNarrationQueue();
    const cue = sentence('s0', 'Bonjour le monde.');
    await queue.resolve(cue);
    await queue.resolve(cue);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preloadAhead déclenche la résolution des N prochains cues sans attendre le résultat', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ audioUrl: '/x.wav', durationMs: 1000, cached: false, providerId: 'piper' }) });
    vi.stubGlobal('fetch', fetchMock);
    const queue = createNarrationQueue();
    const cues = [sentence('s0', 'Un.'), sentence('s1', 'Deux.'), sentence('s2', 'Trois.'), sentence('s3', 'Quatre.')];
    queue.preloadAhead(cues, 2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preloadAhead ne fait jamais échouer l'appelant même si le réseau tombe", () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const queue = createNarrationQueue();
    expect(() => queue.preloadAhead([sentence('s0', 'Un.')])).not.toThrow();
  });

  it('clear() vide le cache : un resolve() après clear() redéclenche un appel réseau', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ audioUrl: '/x.wav', durationMs: 1000, cached: false, providerId: 'piper' }) });
    vi.stubGlobal('fetch', fetchMock);
    const queue = createNarrationQueue();
    const cue = sentence('s0', 'Bonjour.');
    await queue.resolve(cue);
    queue.clear();
    await queue.resolve(cue);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
