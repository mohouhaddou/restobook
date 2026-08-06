import type { PublisherContext } from './PublisherContext';
import type { PublisherPhaseName } from './PublisherConfiguration';

/** Résultats autorisés pour une phase. */
export const PUBLISHER_PHASE_RESULTS = ['SUCCESS', 'WARNING', 'ERROR', 'SKIPPED'] as const;

/** Résultat terminal d’une phase. */
export type PublisherPhaseStatus = (typeof PUBLISHER_PHASE_RESULTS)[number];

/** Résultat global du Publisher. */
export type PublisherStatus = 'SUCCESS' | 'WARNING' | 'ERROR';

/** Valeur retournée par le handler d’une phase. */
export interface PublisherPhaseOutcome<TResult = unknown> {
  /** Résultat normalisé de la phase. */
  readonly status: PublisherPhaseStatus;
  /** Message synthétique du résultat. */
  readonly message?: string;
  /** Résultat publiable intermédiaire ou final, opaque pour le moteur. */
  readonly result?: TResult;
  /** Avertissements structurés de la phase. */
  readonly warnings?: readonly string[];
  /** Erreurs structurées de la phase. */
  readonly errors?: readonly string[];
}

/** Handler injecté pour une phase indépendante. */
export type PublisherPhaseHandler<TResult = unknown> = (
  context: PublisherContext<TResult>,
  phase: PublisherPhaseName,
) => PublisherPhaseOutcome<TResult> | Promise<PublisherPhaseOutcome<TResult>>;

/** Événement observable émis par le Publisher. */
export type PublisherEvent =
  | { readonly type: 'publisher:start'; readonly packageId: string; readonly timestamp: string }
  | { readonly type: 'publisher:end'; readonly packageId: string; readonly timestamp: string; readonly status: PublisherStatus }
  | { readonly type: 'phase:start'; readonly packageId: string; readonly phase: PublisherPhaseName; readonly timestamp: string }
  | { readonly type: 'phase:end'; readonly packageId: string; readonly phase: PublisherPhaseName; readonly timestamp: string; readonly status: PublisherPhaseStatus };

/** Abonné synchrone à un événement Publisher. */
export type PublisherEventListener = (event: PublisherEvent) => void;

/** Bus d’événements minimal et sans dépendance externe. */
export class PublisherEventBus {
  private readonly listeners = new Set<PublisherEventListener>();

  /** Enregistre un abonné et retourne une fonction de désabonnement. */
  on(listener: PublisherEventListener): () => void {
    this.listeners.add(listener);
    return () => this.off(listener);
  }

  /** Retire un abonné. */
  off(listener: PublisherEventListener): void {
    this.listeners.delete(listener);
  }

  /** Diffuse un événement aux abonnés courants. */
  emit(event: PublisherEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
