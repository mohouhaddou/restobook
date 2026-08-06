import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNarrationEngine } from '../NarrationEngine';
import { resetServerStatusCache } from '../ProviderManager';
import type { Block } from '../../../../../../shared/markdown/MarkdownParser';
import type { PaginatedPage } from '../../StoryPaginator';

function paragraph(html: string): Block { return { type: 'paragraph', html }; }
function heading(text: string): Block { return { type: 'heading', depth: 2, text, html: text, anchor: text }; }
function page(blocks: Block[]): PaginatedPage {
  return { blocks, image: null, kind: 'scene', isChapterStart: false };
}

async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }

function mockBackend({ available = true }: { available?: boolean } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes('/narration/status')) {
      return { ok: true, json: async () => ({ available, providerId: available ? 'piper' : null, providerLabel: available ? 'Piper (auto-hébergé)' : null }) };
    }
    if (url.includes('/narration/synthesize')) {
      return { ok: available, json: async () => (available ? { audioUrl: '/clip.wav', durationMs: 10, cached: false, providerId: 'piper' } : { error: 'no provider' }) };
    }
    throw new Error(`URL non simulée dans le test : ${url}`);
  }));
}

beforeEach(() => {
  vi.unstubAllGlobals();
  resetServerStatusCache();
  vi.stubGlobal('SpeechSynthesisUtterance', class { onend: (() => void) | null = null; constructor(public text: string) {} });
  vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] });
  vi.stubGlobal('Audio', class {
    src = ''; playbackRate = 1;
    private listeners: Record<string, Array<() => void>> = { ended: [], error: [] };
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener(type: string, l: () => void) { this.listeners[type].push(l); }
    removeEventListener(type: string, l: () => void) { this.listeners[type] = (this.listeners[type] || []).filter(x => x !== l); }
  });
});

describe('useNarrationEngine', () => {
  it('expose la liste des chapitres dès le montage, sans attendre un playAll()', () => {
    mockBackend();
    const pages = [page([heading('Chapitre 1'), paragraph('<p>Texte.</p>')]), page([heading('Chapitre 2'), paragraph('<p>Autre texte.</p>')])];
    const { result } = renderHook(() => useNarrationEngine({ pages, language: 'fr', onPageChange: vi.fn() }));
    expect(result.current.chapters).toEqual(['Chapitre 1', 'Chapitre 2']);
  });

  it('playAll() démarre la lecture depuis le tout début et pilote onPageChange', async () => {
    mockBackend();
    const onPageChange = vi.fn();
    const pages = [page([paragraph('<p>Page zéro.</p>')]), page([paragraph('<p>Page un.</p>')])];
    const { result } = renderHook(() => useNarrationEngine({ pages, language: 'fr', onPageChange }));

    await act(async () => { result.current.playAll(); await flush(); });
    expect(result.current.status).toBe('playing');
    expect(result.current.activePageIndex).toBe(0);
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it("notifyManualPageChange n'a aucun effet tant que la narration n'a pas démarré (BookReader reste autonome)", async () => {
    mockBackend();
    const onPageChange = vi.fn();
    const pages = [page([paragraph('<p>Page zéro.</p>')]), page([paragraph('<p>Page un.</p>')])];
    const { result } = renderHook(() => useNarrationEngine({ pages, language: 'fr', onPageChange }));

    await act(async () => { result.current.notifyManualPageChange(1); await flush(); });
    expect(onPageChange).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('notifyManualPageChange pendant une lecture active fait continuer la narration sur la nouvelle page', async () => {
    mockBackend();
    const onPageChange = vi.fn();
    const pages = [page([paragraph('<p>Page zéro.</p>')]), page([paragraph('<p>Page un.</p>')])];
    const { result } = renderHook(() => useNarrationEngine({ pages, language: 'fr', onPageChange }));

    await act(async () => { result.current.playAll(); await flush(); });
    await act(async () => { result.current.notifyManualPageChange(1); await flush(); });
    expect(result.current.status).toBe('playing');
    expect(result.current.activePageIndex).toBe(1);
  });

  it('resumeFromChapter positionne et relance la lecture au bon chapitre', async () => {
    mockBackend();
    const pages = [page([heading('Chapitre 1'), paragraph('<p>Un.</p>')]), page([heading('Chapitre 2'), paragraph('<p>Deux.</p>')])];
    const { result } = renderHook(() => useNarrationEngine({ pages, language: 'fr', onPageChange: vi.fn() }));

    await act(async () => { result.current.resumeFromChapter('Chapitre 2'); await flush(); });
    expect(result.current.activeChapter).toBe('Chapitre 2');
    expect(result.current.status).toBe('playing');
  });

  it("reflète l'indisponibilité du provider serveur (providerAvailable=false) et bascule sur le repli quand même", async () => {
    mockBackend({ available: false });
    const pages = [page([paragraph('<p>Texte.</p>')])];
    const { result } = renderHook(() => useNarrationEngine({ pages, language: 'fr', onPageChange: vi.fn() }));

    await act(async () => { await flush(); }); // laisse fetchServerStatus se résoudre
    expect(result.current.providerAvailable).toBe(false);

    await act(async () => { result.current.playAll(); await flush(); });
    expect(result.current.usingFallback).toBe(true);
  });

  it('interroge /status avec la langue de l\'histoire (le provider actif dépend de la langue, pas un statut générique)', async () => {
    const statusCalls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes('/narration/status')) {
        statusCalls.push(url);
        return { ok: true, json: async () => ({ available: true, providerId: 'kokoro', providerLabel: 'Kokoro (auto-hébergé)' }) };
      }
      return { ok: true, json: async () => ({ audioUrl: '/clip.wav', durationMs: 10, cached: false, providerId: 'kokoro' }) };
    }));
    const pages = [page([paragraph('<p>Text.</p>')])];
    const { result } = renderHook(() => useNarrationEngine({ pages, language: 'en', onPageChange: vi.fn() }));
    await act(async () => { await flush(); });
    expect(statusCalls.some(u => u.includes('lang=en'))).toBe(true);
    expect(result.current.providerLabel).toBe('Kokoro (auto-hébergé)');
  });

  it('pause()/resume() exposés par le hook fonctionnent bout en bout', async () => {
    mockBackend();
    const pages = [page([paragraph('<p>Un. Deux.</p>')])];
    const { result } = renderHook(() => useNarrationEngine({ pages, language: 'fr', onPageChange: vi.fn() }));

    await act(async () => { result.current.playAll(); await flush(); });
    await act(async () => { result.current.pause(); });
    expect(result.current.status).toBe('paused');
    await act(async () => { result.current.resume(); await flush(); });
    expect(result.current.status).toBe('playing');
  });
});
