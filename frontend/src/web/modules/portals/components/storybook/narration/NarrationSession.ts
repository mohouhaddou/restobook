/**
 * État global d'une session de narration — "lecture en cours / en pause / terminée", exposé par
 * useNarrationEngine. Pur (aucun effet de bord, aucun accès DOM) : un simple réducteur, testable
 * indépendamment du NarrationController qui l'utilise.
 */

export type NarrationStatus = 'idle' | 'playing' | 'paused' | 'finished' | 'error';

export interface NarrationSessionState {
  readonly status: NarrationStatus;
  readonly cueId: string | null;
  readonly pageIndex: number;
  readonly chapter: string | null;
  readonly providerId: string | null;
  /** true = la phrase en cours est lue par le repli speechSynthesis, pas par le provider serveur. */
  readonly usingFallback: boolean;
  readonly errorMessage: string | null;
}

export const INITIAL_SESSION_STATE: NarrationSessionState = {
  status: 'idle',
  cueId: null,
  pageIndex: 0,
  chapter: null,
  providerId: null,
  usingFallback: false,
  errorMessage: null,
};

export type NarrationSessionEvent =
  | { readonly type: 'PLAY_REQUESTED' }
  | { readonly type: 'CUE_STARTED'; readonly cueId: string | null; readonly pageIndex: number; readonly chapter: string | null; readonly providerId: string | null; readonly usingFallback: boolean }
  | { readonly type: 'PAUSED' }
  | { readonly type: 'FINISHED' }
  | { readonly type: 'ERROR'; readonly message: string }
  | { readonly type: 'RESET' }
  /** Repositionne le curseur (page/chapitre/phrase visée) SANS jamais changer le statut — utilisé
   * quand l'utilisateur tourne une page manuellement pendant une PAUSE : la lecture doit rester en
   * pause et ne reprendre qu'au clic explicite sur "Reprendre", à la nouvelle position. */
  | { readonly type: 'CURSOR_MOVED'; readonly cueId: string | null; readonly pageIndex: number; readonly chapter: string | null };

export function reduceSession(state: NarrationSessionState, event: NarrationSessionEvent): NarrationSessionState {
  switch (event.type) {
    case 'PLAY_REQUESTED':
      return { ...state, status: 'playing', errorMessage: null };
    case 'CUE_STARTED':
      return {
        ...state,
        status: 'playing',
        cueId: event.cueId,
        pageIndex: event.pageIndex,
        chapter: event.chapter,
        providerId: event.providerId,
        usingFallback: event.usingFallback,
      };
    case 'PAUSED':
      return { ...state, status: 'paused' };
    case 'CURSOR_MOVED':
      return { ...state, cueId: event.cueId, pageIndex: event.pageIndex, chapter: event.chapter };
    case 'FINISHED':
      return { ...state, status: 'finished' };
    case 'ERROR':
      return { ...state, status: 'error', errorMessage: event.message };
    case 'RESET':
      return INITIAL_SESSION_STATE;
    default:
      return state;
  }
}
