/**
 * Traduit les changements d'état bruts du NarrationController (un événement par PHRASE) en
 * événements de plus haut niveau que le StoryBook comprend (changement de PAGE, changement de
 * CHAPITRE) — sans déclencher un re-rendu de page à chaque phrase si la page n'a pas changé.
 * Le StoryBook ne pilote jamais le moteur ; c'est ce module qui pousse les mises à jour dans
 * l'autre sens (Controller → BookReader), jamais l'inverse.
 */
import type { NarrationSessionState } from './NarrationSession';

export interface StorySynchronizerCallbacks {
  readonly onPageChange: (pageIndex: number) => void;
  readonly onSentenceChange?: (cueId: string | null) => void;
  readonly onChapterChange?: (chapter: string | null) => void;
}

export interface StorySynchronizer {
  handleStateChange(state: NarrationSessionState): void;
  reset(): void;
}

export function createStorySynchronizer(callbacks: StorySynchronizerCallbacks): StorySynchronizer {
  let lastPageIndex: number | null = null;
  let lastChapter: string | null = null;

  function handleStateChange(state: NarrationSessionState) {
    // Une narration en pause garde sa position affichée ; idle/finished/error n'ont rien à piloter.
    if (state.status !== 'playing' && state.status !== 'paused') return;

    if (lastPageIndex !== state.pageIndex) {
      lastPageIndex = state.pageIndex;
      callbacks.onPageChange(state.pageIndex);
    }
    if (lastChapter !== state.chapter) {
      lastChapter = state.chapter;
      callbacks.onChapterChange?.(state.chapter);
    }
    callbacks.onSentenceChange?.(state.cueId);
  }

  function reset() {
    lastPageIndex = null;
    lastChapter = null;
  }

  return { handleStateChange, reset };
}
