/**
 * Moteur de lecture — avance seul, en continu, à travers TOUTE la timeline (jamais piloté par la
 * page affichée). Sur chaque cue `sentence`, résout l'audio via NarrationQueue puis le joue ; sur
 * chaque cue `dwell` (page 100% image), attend simplement le temps d'affichage avant de continuer.
 * Le StoryBook ne pilote jamais ce moteur : c'est lui qui notifie le StoryBook via onStateChange
 * (voir StorySynchronizer.ts) quand la page/le chapitre actifs changent.
 *
 * N'importe et ne lit jamais de HTML/DOM/React — uniquement des Block[]/cues déjà extraits par
 * SpeechExtractor. La seule interaction DOM est un élément audio Piper, injectable en test.
 */
import type { NarrationTimeline } from './NarrationTimeline';
import { createNarrationCursor, type NarrationCursor } from './NarrationCursor';
import type { NarrationQueue } from './NarrationQueue';
import type { NarrationCue, SentenceCue } from './SpeechExtractor';
import { reduceSession, INITIAL_SESSION_STATE, type NarrationSessionState, type NarrationSessionEvent } from './NarrationSession';

/** Surface minimale d'un `<audio>` — permet d'injecter un faux lecteur en test, sans dépendre du
 * comportement (non implémenté) de HTMLMediaElement.play() sous jsdom. */
export interface AudioLike {
  src: string;
  playbackRate: number;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: 'ended' | 'error', listener: () => void): void;
  removeEventListener(type: 'ended' | 'error', listener: () => void): void;
}

const PRELOAD_AHEAD = 3;

export interface NarrationControllerOptions {
  readonly timeline: NarrationTimeline;
  readonly queue: NarrationQueue;
  readonly onStateChange: (state: NarrationSessionState) => void;
  readonly rate?: number;
  readonly createAudioElement?: () => AudioLike;
}

export interface NarrationController {
  getState(): NarrationSessionState;
  playFrom(index: number): void;
  pause(): void;
  resume(): void;
  stop(): void;
  seekToSentence(cueId: string): void;
  seekToChapter(chapter: string): void;
  seekToPage(pageIndex: number): void;
  /** Repositionne le curseur sur la première phrase de `pageIndex` SANS jamais démarrer la
   * lecture — pour une navigation manuelle pendant une PAUSE : la narration reste en pause et ne
   * reprendra qu'au prochain resume(), depuis cette nouvelle position. */
  moveCursorToPage(pageIndex: number): void;
  setRate(rate: number): void;
  destroy(): void;
}

export function createNarrationController(options: NarrationControllerOptions): NarrationController {
  const { timeline, queue, onStateChange } = options;
  let rate = options.rate ?? 1;
  const createAudio = options.createAudioElement ?? (() => new Audio() as unknown as AudioLike);

  let cursor: NarrationCursor = createNarrationCursor(timeline, 0);
  let state: NarrationSessionState = INITIAL_SESSION_STATE;
  // Toute commande (play/pause/stop/seek) incrémente `generation` : un résultat async (résolution
  // audio, fin de fallback) d'une commande précédente qui arrive après coup est purement ignoré —
  // évite qu'une phrase déjà abandonnée ne démarre quand même après un pause()/seek() rapide.
  let generation = 0;
  let audio: AudioLike | null = null;
  let dwellTimer: ReturnType<typeof setTimeout> | null = null;
  // `audio` est réutilisé d'un cue à l'autre (un seul élément <audio>, jamais recréé) — ses
  // listeners doivent donc être explicitement détachés à chaque changement de cue/commande, sinon
  // ils s'accumulent indéfiniment sur le même élément à chaque phrase lue.
  let attachedEnded: (() => void) | null = null;
  let attachedError: (() => void) | null = null;

  function setState(next: NarrationSessionState) {
    state = next;
    onStateChange(state);
  }
  function dispatch(event: NarrationSessionEvent) {
    setState(reduceSession(state, event));
  }

  function detachAudioListeners() {
    if (audio && attachedEnded) audio.removeEventListener('ended', attachedEnded);
    if (audio && attachedError) audio.removeEventListener('error', attachedError);
    attachedEnded = null;
    attachedError = null;
  }

  function clearPendingPlayback() {
    if (dwellTimer) { clearTimeout(dwellTimer); dwellTimer = null; }
    if (audio) audio.pause();
    detachAudioListeners();
  }

  function upcomingSentenceCues(fromIndex: number): SentenceCue[] {
    const result: SentenceCue[] = [];
    for (let i = fromIndex; i < timeline.cues.length && result.length < PRELOAD_AHEAD; i++) {
      const c = timeline.cueAt(i);
      if (c?.type === 'sentence') result.push(c);
    }
    return result;
  }

  function advance(myGeneration: number) {
    if (cursor.atEnd) { dispatch({ type: 'FINISHED' }); return; }
    cursor = cursor.next();
    playCue(cursor.cue as NarrationCue, myGeneration);
  }

  function playCue(cue: NarrationCue, myGeneration: number) {
    if (cue.type === 'dwell') {
      dispatch({ type: 'CUE_STARTED', cueId: cue.id, pageIndex: cue.pageIndex, chapter: cue.chapter, providerId: null, usingFallback: false });
      dwellTimer = setTimeout(() => { if (myGeneration === generation) advance(myGeneration); }, cue.durationMs);
      return;
    }

    queue.resolve(cue).then(resolved => {
      if (myGeneration !== generation) return; // une commande plus récente a déjà pris le relais

      if (resolved.kind === 'audio') {
        dispatch({ type: 'CUE_STARTED', cueId: cue.id, pageIndex: cue.pageIndex, chapter: cue.chapter, providerId: resolved.providerId, usingFallback: false });
        if (!audio) audio = createAudio();
        detachAudioListeners(); // le cue précédent a fini, mais ses listeners restaient attachés
        const current = audio;
        const onEnded = () => { detachAudioListeners(); if (myGeneration === generation) advance(myGeneration); };
        const onError = () => {
          detachAudioListeners();
          if (myGeneration !== generation) return;
          dispatch({ type: 'ERROR', message: 'Échec de lecture de l’audio Piper' });
        };
        attachedEnded = onEnded;
        attachedError = onError;
        current.addEventListener('ended', onEnded);
        current.addEventListener('error', onError);
        current.src = resolved.url;
        current.playbackRate = rate;
        Promise.resolve(current.play()).catch(onError);
      } else {
        dispatch({ type: 'ERROR', message: resolved.message });
      }

      queue.preloadAhead(upcomingSentenceCues(cursor.index + 1));
    }).catch(() => { if (myGeneration === generation) dispatch({ type: 'ERROR', message: 'Échec de résolution audio' }); });
  }

  function playFrom(index: number) {
    generation += 1;
    const myGeneration = generation;
    clearPendingPlayback();
    cursor = createNarrationCursor(timeline, index);
    dispatch({ type: 'PLAY_REQUESTED' });
    if (!cursor.cue) { dispatch({ type: 'FINISHED' }); return; }
    playCue(cursor.cue, myGeneration);
  }

  function pause() {
    if (state.status !== 'playing') return;
    generation += 1; // annule toute résolution/fallback encore en vol pour le cue courant
    clearPendingPlayback();
    dispatch({ type: 'PAUSED' });
  }

  function resume() {
    if (state.status !== 'paused') return;
    playFrom(cursor.index);
  }

  function stop() {
    generation += 1;
    clearPendingPlayback();
    cursor = createNarrationCursor(timeline, 0);
    dispatch({ type: 'RESET' });
  }

  // Navigation (manuelle ou "reprendre depuis...") : toujours une lecture continue depuis le
  // nouveau point — jamais un arrêt, conformément à l'exigence de continuité de la narration.
  function seekToIndex(index: number) { playFrom(index); }
  function seekToSentence(cueId: string) { const i = timeline.indexOf(cueId); seekToIndex(i >= 0 ? i : cursor.index); }
  function seekToChapter(chapter: string) { const i = timeline.firstIndexForChapter(chapter); seekToIndex(i >= 0 ? i : cursor.index); }
  function seekToPage(pageIndex: number) { const i = timeline.firstIndexForPage(pageIndex); seekToIndex(i >= 0 ? i : cursor.index); }

  function moveCursorToPage(pageIndex: number) {
    const i = timeline.firstIndexForPage(pageIndex);
    if (i < 0) return;
    cursor = createNarrationCursor(timeline, i);
    dispatch({ type: 'CURSOR_MOVED', cueId: cursor.cue?.id ?? null, pageIndex: cursor.cue?.pageIndex ?? pageIndex, chapter: cursor.cue?.chapter ?? null });
  }

  function setRate(next: number) {
    rate = next;
    if (audio) audio.playbackRate = next;
  }

  function destroy() {
    generation += 1;
    clearPendingPlayback();
    audio = null;
  }

  return {
    getState: () => state,
    playFrom, pause, resume, stop,
    seekToSentence, seekToChapter, seekToPage, moveCursorToPage,
    setRate, destroy,
  };
}
