import type { PublisherLogEntry } from './PublisherContext';
import type { PublisherPhaseName } from './PublisherConfiguration';
import type { PublisherPhaseStatus, PublisherStatus } from './PublisherEvents';

/** Rapport détaillé d’une phase du pipeline. */
export interface PublisherPhaseReport<TResult = unknown> {
  /** Phase concernée. */
  readonly phase: PublisherPhaseName;
  /** Résultat terminal de la phase. */
  readonly status: PublisherPhaseStatus;
  /** Date ISO 8601 de début. */
  readonly startedAt: string;
  /** Date ISO 8601 de fin. */
  readonly completedAt: string;
  /** Durée en millisecondes. */
  readonly durationMs: number;
  /** Message synthétique. */
  readonly message?: string;
  /** Résultat opaque retourné par la phase. */
  readonly result?: TResult;
  /** Avertissements de la phase. */
  readonly warnings: readonly string[];
  /** Erreurs de la phase. */
  readonly errors: readonly string[];
}

/** Rapport complet retourné par le Publisher Engine. */
export interface PublisherReport<TResult = unknown> {
  /** Identifiant du paquet source. */
  readonly packageId: string;
  /** Résultat global du pipeline. */
  readonly status: PublisherStatus;
  /** Date ISO 8601 de début. */
  readonly startedAt: string;
  /** Date ISO 8601 de fin. */
  readonly completedAt: string;
  /** Durée totale en millisecondes. */
  readonly durationMs: number;
  /** Rapports de toutes les phases, y compris celles ignorées. */
  readonly phases: readonly PublisherPhaseReport<TResult>[];
  /** Noms des phases dont un handler a été exécuté. */
  readonly executedSteps: readonly PublisherPhaseName[];
  /** Noms des phases désactivées ou non exécutées après une erreur. */
  readonly skippedSteps: readonly PublisherPhaseName[];
  /** Erreurs agrégées. */
  readonly errors: readonly string[];
  /** Avertissements agrégés. */
  readonly warnings: readonly string[];
  /** Résultat publiable final, opaque pour le moteur. */
  readonly result?: TResult;
  /** Journal complet en mémoire. */
  readonly logs: readonly PublisherLogEntry[];
}
