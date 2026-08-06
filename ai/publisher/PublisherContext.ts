import type { ContentPackage } from '../types';
import type { PublisherConfiguration, PublisherPhaseName } from './PublisherConfiguration';
import type { PublisherPhaseStatus } from './PublisherEvents';

/** Niveau d’une entrée du journal Publisher. */
export type PublisherLogLevel = 'info' | 'warning' | 'error';

/** Type d’événement journalisé par le Publisher. */
export type PublisherLogEvent =
  | 'publisher:start'
  | 'publisher:end'
  | 'phase:start'
  | 'phase:end'
  | 'warning'
  | 'error'
  | 'result';

/** Entrée structurée et conservée uniquement en mémoire. */
export interface PublisherLogEntry {
  /** Date ISO 8601 de l’entrée. */
  readonly timestamp: string;
  /** Niveau de sévérité. */
  readonly level: PublisherLogLevel;
  /** Type stable de l’événement. */
  readonly event: PublisherLogEvent;
  /** Message lisible. */
  readonly message: string;
  /** Phase concernée, le cas échéant. */
  readonly phase?: PublisherPhaseName;
  /** Résultat de phase associé, le cas échéant. */
  readonly status?: PublisherPhaseStatus;
  /** Durée associée, en millisecondes. */
  readonly durationMs?: number;
}

/** Horodatages mutables d’une exécution Publisher. */
export interface PublisherTimestamps {
  /** Début ISO 8601 de l’exécution. */
  startedAt?: string;
  /** Fin ISO 8601 de l’exécution. */
  completedAt?: string;
  /** Début ISO 8601 de la phase courante. */
  currentPhaseStartedAt?: string;
  /** Fin ISO 8601 de la dernière phase terminée. */
  lastPhaseCompletedAt?: string;
}

/** Contexte partagé par les phases du pipeline. */
export interface PublisherContext<TResult = unknown> {
  /** `ContentPackage` source, jamais modifié par le moteur. */
  readonly package: ContentPackage;
  /** Identifiant logique d’espace de travail, sans accès disque. */
  readonly workspace: string;
  /** Configuration de l’exécution. */
  readonly configuration: PublisherConfiguration;
  /** Phase actuellement exécutée. */
  currentPhase?: PublisherPhaseName;
  /** Horodatages de l’exécution. */
  readonly timestamps: PublisherTimestamps;
  /** Journal en mémoire. */
  readonly logs: PublisherLogEntry[];
  /** Résultat publiable intermédiaire ou final, opaque pour le moteur. */
  result?: TResult;
}

/** Entrées requises pour créer un contexte Publisher. */
export interface PublisherContextInput {
  /** Paquet source validé ou à valider. */
  readonly package: ContentPackage;
  /** Identifiant logique d’espace de travail. */
  readonly workspace: string;
  /** Configuration, optionnelle lorsque la configuration canonique suffit. */
  readonly configuration?: PublisherConfiguration;
}
