/**
 * Point d'entrée public du Narration Engine — hook useNarrationEngine(). Construit la timeline
 * complète de l'histoire une seule fois (SpeechExtractor → NarrationTimeline), possède son propre
 * NarrationController qui avance seul à travers toute l'histoire, et notifie BookReader des
 * changements de page/chapitre via StorySynchronizer — jamais l'inverse : BookReader ne pilote pas
 * la narration, il ne fait qu'appliquer les changements de page qu'elle demande, et lui signale
 * (notifyManualPageChange) quand l'utilisateur tourne lui-même une page pendant la lecture.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PaginatedPage } from '../StoryPaginator';
import { extractSpeechCues } from './SpeechExtractor';
import { createNarrationTimeline, type NarrationTimeline } from './NarrationTimeline';
import { createNarrationQueue } from './NarrationQueue';
import { createNarrationController, type NarrationController } from './NarrationController';
import { createStorySynchronizer } from './StorySynchronizer';
import { fetchServerStatus, type ServerStatus } from './ProviderManager';
import { INITIAL_SESSION_STATE, type NarrationSessionState, type NarrationStatus } from './NarrationSession';

export interface UseNarrationEngineOptions {
  readonly pages: readonly PaginatedPage[];
  readonly language: string;
  /** Identifiant de la voix serveur Piper à utiliser (voir VoiceManager.ts) — null laisse le
   * backend appliquer sa voix par défaut pour la langue demandée. */
  readonly voice?: string | null;
  readonly rate?: number;
  readonly onPageChange: (pageIndex: number) => void;
}

export interface NarrationEngineApi {
  readonly status: NarrationStatus;
  readonly activeSentenceId: string | null;
  /** Texte exact de la phrase en cours — sert de clé de correspondance pour
   * NarrationHighlightRenderer (qui redécoupe le texte du bloc affiché et cherche la même
   * phrase par son texte, jamais par un id global qu'il ne connaît pas). */
  readonly activeSentenceText: string | null;
  readonly activePageIndex: number;
  readonly activeChapter: string | null;
  readonly chapters: readonly string[];
  readonly providerAvailable: boolean;
  readonly providerLabel: string | null;
  readonly usingFallback: boolean;
  readonly errorMessage: string | null;
  readonly rate: number;
  playAll(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  resumeFromSentence(cueId: string): void;
  resumeFromChapter(chapter: string): void;
  resumeFromPage(pageIndex: number): void;
  /** À appeler par BookReader quand l'utilisateur tourne une page manuellement (flèche/swipe) —
   * n'a d'effet que si une narration est active (playing/paused) : sinon BookReader reste
   * totalement autonome, comme avant l'existence du moteur. */
  notifyManualPageChange(pageIndex: number): void;
  setRate(rate: number): void;
}

export function useNarrationEngine({ pages, language, voice = null, rate = 1, onPageChange }: UseNarrationEngineOptions): NarrationEngineApi {
  const [state, setState] = useState<NarrationSessionState>(INITIAL_SESSION_STATE);
  const [chapters, setChapters] = useState<readonly string[]>([]);
  const [providerStatus, setProviderStatus] = useState<ServerStatus>({ available: false, providerId: null, providerLabel: null });

  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const queueRef = useRef<ReturnType<typeof createNarrationQueue> | null>(null);
  const controllerRef = useRef<NarrationController | null>(null);
  const timelineRef = useRef<NarrationTimeline | null>(null);
  const synchronizerRef = useRef(createStorySynchronizer({
    onPageChange: p => onPageChangeRef.current(p),
  }));

  useEffect(() => {
    let cancelled = false;
    // Le statut est demandé par langue pour vérifier la disponibilité du modèle Piper.
    fetchServerStatus(language).then(status => { if (!cancelled) setProviderStatus(status); });
    return () => { cancelled = true; };
  }, [language]);

  useEffect(() => {
    const cues = extractSpeechCues(pages);
    const newTimeline = createNarrationTimeline(cues);

    const previousController = controllerRef.current;
    const previousTimeline = timelineRef.current;
    const previousState = previousController?.getState();
    const wasActive = previousState?.status === 'playing' || previousState?.status === 'paused';

    // Un redimensionnement/une rotation d'écran change la pagination (donc la page de chaque
    // phrase) sans changer le TEXTE de la phrase en cours : on la retrouve dans la nouvelle
    // timeline par son texte pour ne jamais interrompre une lecture en cours à cause du responsive.
    let resumeIndex = -1;
    if (wasActive && previousTimeline && previousState?.cueId) {
      const previousCue = previousTimeline.cueAt(previousTimeline.indexOf(previousState.cueId));
      if (previousCue) {
        resumeIndex = newTimeline.cues.findIndex(c => (
          c.type === previousCue.type && (c.type === 'sentence' && previousCue.type === 'sentence' ? c.text === previousCue.text : c.id === previousCue.id)
        ));
      }
    }

    previousController?.destroy();
    // Reconstruite à chaque changement de langue/voix (pas seulement à la création) : sinon la
    // queue continuerait de résoudre l'audio avec la langue/voix d'origine indéfiniment.
    queueRef.current = createNarrationQueue({ lang: language, voice: voice ?? undefined });
    timelineRef.current = newTimeline;
    synchronizerRef.current.reset();
    setChapters(newTimeline.chapters);

    const controller = createNarrationController({
      timeline: newTimeline,
      queue: queueRef.current,
      rate: rateRef.current,
      onStateChange: next => { synchronizerRef.current.handleStateChange(next); setState(next); },
    });
    controllerRef.current = controller;

    if (resumeIndex >= 0) controller.playFrom(resumeIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, language, voice]);

  useEffect(() => () => controllerRef.current?.destroy(), []);

  const playAll = useCallback(() => controllerRef.current?.playFrom(0), []);
  const pause = useCallback(() => controllerRef.current?.pause(), []);
  const resume = useCallback(() => controllerRef.current?.resume(), []);
  const stop = useCallback(() => controllerRef.current?.stop(), []);
  const resumeFromSentence = useCallback((cueId: string) => controllerRef.current?.seekToSentence(cueId), []);
  const resumeFromChapter = useCallback((chapter: string) => controllerRef.current?.seekToChapter(chapter), []);
  const resumeFromPage = useCallback((pageIndex: number) => controllerRef.current?.seekToPage(pageIndex), []);
  const setRate = useCallback((next: number) => controllerRef.current?.setRate(next), []);

  const statusRef = useRef(state.status);
  statusRef.current = state.status;
  const notifyManualPageChange = useCallback((pageIndex: number) => {
    // En lecture : la narration continue sans jamais s'arrêter (voir seekToPage). En pause : on
    // ne fait que repositionner le curseur — la lecture reste en pause et ne reprend qu'au
    // prochain clic explicite sur "Reprendre", depuis cette nouvelle page (voir
    // NarrationController.moveCursorToPage). Idle/finished/error : no-op, le StoryBook reste
    // entièrement autonome.
    if (statusRef.current === 'playing') controllerRef.current?.seekToPage(pageIndex);
    else if (statusRef.current === 'paused') controllerRef.current?.moveCursorToPage(pageIndex);
  }, []);

  const activeSentenceText = useMemo(() => {
    if (!state.cueId || !timelineRef.current) return null;
    const cue = timelineRef.current.cueAt(timelineRef.current.indexOf(state.cueId));
    return cue?.type === 'sentence' ? cue.text : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cueId]);

  return useMemo<NarrationEngineApi>(() => ({
    status: state.status,
    activeSentenceId: state.cueId,
    activeSentenceText,
    activePageIndex: state.pageIndex,
    activeChapter: state.chapter,
    chapters,
    providerAvailable: providerStatus.available,
    providerLabel: providerStatus.providerLabel,
    usingFallback: state.usingFallback,
    errorMessage: state.errorMessage,
    rate,
    playAll, pause, resume, stop,
    resumeFromSentence, resumeFromChapter, resumeFromPage,
    notifyManualPageChange, setRate,
  }), [state, activeSentenceText, chapters, providerStatus, rate, playAll, pause, resume, stop, resumeFromSentence, resumeFromChapter, resumeFromPage, notifyManualPageChange, setRate]);
}
