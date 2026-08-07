import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNarrationController, type AudioLike } from '../NarrationController';
import { createNarrationTimeline } from '../NarrationTimeline';
import { extractSpeechCues } from '../SpeechExtractor';
import type { NarrationQueue } from '../NarrationQueue';
import type { ResolvedAudio } from '../ProviderManager';
import type { NarrationSessionState } from '../NarrationSession';
import type { Block } from '../../../../../../markdown/MarkdownParser';
import type { PaginatedPage } from '../../StoryPaginator';

function paragraph(html: string): Block { return { type: 'paragraph', html }; }
function heading(text: string): Block { return { type: 'heading', depth: 2, text, html: text, anchor: text }; }
function image(src: string): Block { return { type: 'image', src, alt: '', title: null }; }
function page(blocks: Block[]): PaginatedPage {
  return { blocks, image: null, kind: 'scene', isChapterStart: false };
}

class FakeAudio implements AudioLike {
  src = '';
  playbackRate = 1;
  playCallCount = 0;
  private listeners: { ended: Array<() => void>; error: Array<() => void> } = { ended: [], error: [] };
  play() { this.playCallCount += 1; return Promise.resolve(); }
  pause() {}
  addEventListener(type: 'ended' | 'error', listener: () => void) { this.listeners[type].push(listener); }
  removeEventListener(type: 'ended' | 'error', listener: () => void) { this.listeners[type] = this.listeners[type].filter(l => l !== listener); }
  emit(type: 'ended' | 'error') { this.listeners[type].slice().forEach(l => l()); }
  listenerCount(type: 'ended' | 'error') { return this.listeners[type].length; }
}

function fakeQueue(resolved: ResolvedAudio = { kind: 'audio', url: '/clip.wav', durationMs: 500, providerId: 'piper', cached: false }): NarrationQueue {
  return {
    resolve: vi.fn().mockResolvedValue(resolved),
    preloadAhead: vi.fn(),
    clear: vi.fn(),
  };
}

// Flush des microtâches (résolutions de Promise) sans dépendre de setTimeout, pour rester
// compatible avec les tests qui activent des timers fictifs (cue `dwell`).
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('NarrationController — lecture continue à travers toute la timeline', () => {
  it('lit la première phrase automatiquement au playFrom(0), puis avance à onEnded jusqu\'à FINISHED', async () => {
    const pages = [page([paragraph('<p>Phrase un. Phrase deux.</p>')])];
    const timeline = createNarrationTimeline(extractSpeechCues(pages));
    const audio = new FakeAudio();
    const states: NarrationSessionState[] = [];
    const controller = createNarrationController({
      timeline, queue: fakeQueue(), onStateChange: s => states.push(s), createAudioElement: () => audio,
    });

    controller.playFrom(0);
    await flush();
    expect(states.at(-1)?.status).toBe('playing');
    expect(states.at(-1)?.cueId).toBe(timeline.cues[0].id);
    expect(audio.playCallCount).toBe(1);

    audio.emit('ended');
    await flush();
    expect(states.at(-1)?.cueId).toBe(timeline.cues[1].id);
    expect(audio.playCallCount).toBe(2);

    audio.emit('ended');
    await flush();
    expect(states.at(-1)?.status).toBe('finished');
  });

  it('une page qui commence par une image ne bloque jamais le départ de la narration (dwell puis phrase suivante)', async () => {
    vi.useFakeTimers();
    try {
      const pages = [page([image('cover.webp')]), page([paragraph('<p>Le texte qui suit.</p>')])];
      const timeline = createNarrationTimeline(extractSpeechCues(pages));
      const states: NarrationSessionState[] = [];
      const controller = createNarrationController({ timeline, queue: fakeQueue(), onStateChange: s => states.push(s) });

      controller.playFrom(0);
      // Le cue dwell démarre de façon synchrone (pas d'attente réseau) : pas de silence bloquant.
      expect(states.at(-1)?.status).toBe('playing');
      expect(states.at(-1)?.pageIndex).toBe(0);

      await vi.advanceTimersByTimeAsync(2400);
      expect(states.at(-1)?.pageIndex).toBe(1);
      expect(states.at(-1)?.cueId).toBe(timeline.cues[1].id);
    } finally {
      vi.useRealTimers();
    }
  });

  it('associe le bon chapitre à chaque phrase au fil de la lecture', async () => {
    const pages = [
      page([heading('Chapitre 1'), paragraph('<p>Texte un.</p>')]),
      page([heading('Chapitre 2'), paragraph('<p>Texte deux.</p>')]),
    ];
    const timeline = createNarrationTimeline(extractSpeechCues(pages));
    const audio = new FakeAudio();
    const states: NarrationSessionState[] = [];
    const controller = createNarrationController({ timeline, queue: fakeQueue(), onStateChange: s => states.push(s), createAudioElement: () => audio });

    controller.playFrom(0);
    await flush();
    expect(states.at(-1)?.chapter).toBe('Chapitre 1');
    audio.emit('ended'); await flush(); // phrase du texte du chapitre 1
    audio.emit('ended'); await flush(); // titre "Chapitre 2"
    expect(states.at(-1)?.chapter).toBe('Chapitre 2');
  });

  it('la navigation manuelle (seekToPage) continue la narration sans interruption, sans double avance de la phrase abandonnée', async () => {
    const pages = [
      page([paragraph('<p>Page zéro.</p>')]),
      page([paragraph('<p>Page un.</p>')]),
    ];
    const timeline = createNarrationTimeline(extractSpeechCues(pages));
    const audio = new FakeAudio();
    const states: NarrationSessionState[] = [];
    const controller = createNarrationController({ timeline, queue: fakeQueue(), onStateChange: s => states.push(s), createAudioElement: () => audio });

    controller.playFrom(0);
    await flush();
    const firstCueAudio = audio; // même instance (réutilisée)
    controller.seekToPage(1);
    await flush();
    expect(states.at(-1)?.pageIndex).toBe(1);

    // La phrase de la page 0, abandonnée par le seek, "finit" quand même son 'ended' en retard —
    // ne doit ni faire régresser l'état ni avancer une deuxième fois.
    firstCueAudio.emit('ended');
    await flush();
    expect(states.at(-1)?.pageIndex).toBe(1);
  });

  it('pause()/resume() : la lecture reprend exactement où elle s\'était arrêtée', async () => {
    const pages = [page([paragraph('<p>Un. Deux.</p>')])];
    const timeline = createNarrationTimeline(extractSpeechCues(pages));
    const audio = new FakeAudio();
    const states: NarrationSessionState[] = [];
    const controller = createNarrationController({ timeline, queue: fakeQueue(), onStateChange: s => states.push(s), createAudioElement: () => audio });

    controller.playFrom(0);
    await flush();
    controller.pause();
    expect(states.at(-1)?.status).toBe('paused');
    expect(states.at(-1)?.cueId).toBe(timeline.cues[0].id);

    controller.resume();
    await flush();
    expect(states.at(-1)?.status).toBe('playing');
    expect(states.at(-1)?.cueId).toBe(timeline.cues[0].id);
  });

  it('moveCursorToPage pendant une PAUSE repositionne le curseur sans jamais relancer la lecture', async () => {
    const pages = [
      page([paragraph('<p>Page zéro.</p>')]),
      page([paragraph('<p>Page un.</p>')]),
    ];
    const timeline = createNarrationTimeline(extractSpeechCues(pages));
    const audio = new FakeAudio();
    const states: NarrationSessionState[] = [];
    const controller = createNarrationController({ timeline, queue: fakeQueue(), onStateChange: s => states.push(s), createAudioElement: () => audio });

    controller.playFrom(0);
    await flush();
    controller.pause();
    const playCallsAtPause = audio.playCallCount;
    expect(states.at(-1)?.status).toBe('paused');

    // Navigation manuelle vers la page 1 pendant la pause : le curseur doit se déplacer mais la
    // lecture ne doit ni reprendre ni jouer le moindre audio (bug corrigé : elle redémarrait
    // automatiquement en tête de la nouvelle page).
    controller.moveCursorToPage(1);
    await flush();
    expect(states.at(-1)?.status).toBe('paused');
    expect(states.at(-1)?.pageIndex).toBe(1);
    expect(states.at(-1)?.cueId).toBe(timeline.cues[1].id);
    expect(audio.playCallCount).toBe(playCallsAtPause); // aucun nouvel appel à play()

    // resume() doit reprendre depuis la NOUVELLE position (page 1), pas l'ancienne.
    controller.resume();
    await flush();
    expect(states.at(-1)?.status).toBe('playing');
    expect(states.at(-1)?.cueId).toBe(timeline.cues[1].id);
    expect(audio.playCallCount).toBe(playCallsAtPause + 1);
  });

  it('bascule sur speechSynthesis si le provider audio échoue en cours de lecture, puis continue', async () => {
    const pages = [page([paragraph('<p>Un. Deux.</p>')])];
    const timeline = createNarrationTimeline(extractSpeechCues(pages));
    const audio = new FakeAudio();
    vi.stubGlobal('SpeechSynthesisUtterance', class { onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(public text: string) {} });
    const speakMock = vi.fn((utterance: { onend: (() => void) | null }) => { (speakMock as any).lastUtterance = utterance; });
    vi.stubGlobal('speechSynthesis', { speak: speakMock, cancel: vi.fn() });

    const states: NarrationSessionState[] = [];
    const controller = createNarrationController({ timeline, queue: fakeQueue(), onStateChange: s => states.push(s), createAudioElement: () => audio });
    controller.playFrom(0);
    await flush();
    audio.emit('error');
    await flush();
    expect(states.at(-1)?.usingFallback).toBe(true);
    expect(speakMock).toHaveBeenCalledTimes(1);
    (speakMock as any).lastUtterance.onend?.();
    await flush();
    expect(states.at(-1)?.cueId).toBe(timeline.cues[1].id);
    vi.unstubAllGlobals();
  });

  it('ne réutilise jamais un `<audio>` avec des listeners de l\'ancien cue encore attachés (pas de fuite)', async () => {
    const pages = [page([paragraph('<p>Un. Deux. Trois.</p>')])];
    const timeline = createNarrationTimeline(extractSpeechCues(pages));
    const audio = new FakeAudio();
    const controller = createNarrationController({ timeline, queue: fakeQueue(), onStateChange: () => {}, createAudioElement: () => audio });

    controller.playFrom(0);
    await flush();
    expect(audio.listenerCount('ended')).toBe(1);
    audio.emit('ended');
    await flush();
    expect(audio.listenerCount('ended')).toBe(1); // toujours un seul, pas deux accumulés
  });

  it('une timeline vide termine immédiatement sans jamais tenter de lire quoi que ce soit', () => {
    const timeline = createNarrationTimeline([]);
    const states: NarrationSessionState[] = [];
    const controller = createNarrationController({ timeline, queue: fakeQueue(), onStateChange: s => states.push(s) });
    controller.playFrom(0);
    expect(states.at(-1)?.status).toBe('finished');
  });
});
