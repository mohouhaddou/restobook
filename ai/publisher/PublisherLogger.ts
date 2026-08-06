import type {
  PublisherContext,
  PublisherLogEntry,
  PublisherLogEvent,
  PublisherLogLevel,
} from './PublisherContext';
import type { PublisherPhaseName } from './PublisherConfiguration';
import type {
  PublisherPhaseOutcome,
  PublisherStatus,
} from './PublisherEvents';

/** Horloge injectable du Publisher. */
export type PublisherClock = () => Date;

/** Journal en mémoire du Publisher. */
export class PublisherLogger {
  constructor(private readonly now: PublisherClock = () => new Date()) {}

  /** Journalise le début de l’exécution. */
  publisherStarted(context: PublisherContext): void {
    this.push(context, 'info', 'publisher:start', `Publisher démarré pour ${context.package.id}.`);
  }

  /** Journalise la fin, la durée et le résultat global. */
  publisherCompleted(
    context: PublisherContext,
    status: PublisherStatus,
    durationMs: number,
  ): void {
    const level = status === 'ERROR' ? 'error' : status === 'WARNING' ? 'warning' : 'info';
    this.push(context, level, 'publisher:end', `Publisher terminé pour ${context.package.id}.`, undefined, status, durationMs);
  }

  /** Journalise le début d’une phase. */
  phaseStarted(context: PublisherContext, phase: PublisherPhaseName): void {
    this.push(context, 'info', 'phase:start', `Phase ${phase} démarrée.`, phase);
  }

  /** Journalise la fin et les diagnostics d’une phase. */
  phaseCompleted<TResult>(
    context: PublisherContext<TResult>,
    phase: PublisherPhaseName,
    outcome: PublisherPhaseOutcome<TResult>,
    durationMs: number,
  ): void {
    const level = outcome.status === 'ERROR' ? 'error' : outcome.status === 'WARNING' ? 'warning' : 'info';
    this.push(context, level, 'phase:end', outcome.message || `Phase ${phase} terminée.`, phase, outcome.status, durationMs);
    for (const warning of outcome.warnings || []) {
      this.push(context, 'warning', 'warning', warning, phase);
    }
    for (const error of outcome.errors || []) {
      this.push(context, 'error', 'error', error, phase);
    }
  }

  /** Journalise une erreur capturée par le pipeline. */
  executionError(context: PublisherContext, message: string, phase?: PublisherPhaseName): void {
    this.push(context, 'error', 'error', message, phase);
  }

  private push(
    context: PublisherContext,
    level: PublisherLogLevel,
    event: PublisherLogEvent,
    message: string,
    phase?: PublisherPhaseName,
    status?: import('./PublisherEvents').PublisherPhaseStatus | PublisherStatus,
    durationMs?: number,
  ): void {
    const entry: PublisherLogEntry = {
      timestamp: this.now().toISOString(),
      level,
      event,
      message,
      phase,
      status: status && status !== 'SUCCESS' && status !== 'WARNING' && status !== 'ERROR'
        ? status
        : status as import('./PublisherEvents').PublisherPhaseStatus | undefined,
      durationMs,
    };
    context.logs.push(entry);
  }
}
