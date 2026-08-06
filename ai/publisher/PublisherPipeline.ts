import type { PublisherContext } from './PublisherContext';
import type { PublisherPhaseConfiguration, PublisherPhaseName } from './PublisherConfiguration';
import { PublisherPhaseHandlerNotFoundError } from './PublisherErrors';
import {
  PUBLISHER_PHASE_RESULTS,
  PublisherEventBus,
  type PublisherPhaseHandler,
  type PublisherPhaseOutcome,
} from './PublisherEvents';
import { PublisherLogger, type PublisherClock } from './PublisherLogger';
import type { PublisherPhaseReport, PublisherReport } from './PublisherReport';

/**
 * Pipeline séquentiel des phases Publisher.
 *
 * Chaque phase est indépendante et sa logique est fournie par un handler
 * injecté. Le pipeline ne réalise aucune transformation par lui-même.
 */
export class PublisherPipeline<TResult = unknown> {
  private readonly handlers = new Map<PublisherPhaseName, PublisherPhaseHandler<TResult>>();

  constructor(
    private readonly logger: PublisherLogger = new PublisherLogger(),
    private readonly events: PublisherEventBus = new PublisherEventBus(),
    private readonly now: PublisherClock = () => new Date(),
  ) {}

  /** Enregistre ou remplace le handler d’une phase. */
  registerHandler(phase: PublisherPhaseName, handler: PublisherPhaseHandler<TResult>): void {
    this.handlers.set(phase, handler);
  }

  /** Retire le handler d’une phase. */
  unregisterHandler(phase: PublisherPhaseName): boolean {
    return this.handlers.delete(phase);
  }

  /** Indique si une phase possède un handler. */
  hasHandler(phase: PublisherPhaseName): boolean {
    return this.handlers.has(phase);
  }

  /** Liste les phases actives sans handler. */
  missingHandlers(phases: readonly PublisherPhaseConfiguration[]): readonly PublisherPhaseName[] {
    return phases
      .filter(phase => phase.enabled && !this.handlers.has(phase.name))
      .map(phase => phase.name);
  }

  /** Retourne le bus d’événements observable. */
  get eventBus(): PublisherEventBus {
    return this.events;
  }

  /** Exécute le pipeline et retourne son rapport complet. */
  async execute(context: PublisherContext<TResult>): Promise<PublisherReport<TResult>> {
    const startedAtDate = this.now();
    const startedAt = startedAtDate.toISOString();
    context.timestamps.startedAt = startedAt;
    context.timestamps.completedAt = undefined;
    this.logger.publisherStarted(context);
    this.events.emit({ type: 'publisher:start', packageId: context.package.id, timestamp: startedAt });

    const phaseReports: PublisherPhaseReport<TResult>[] = [];
    const executedSteps: PublisherPhaseName[] = [];
    const skippedSteps: PublisherPhaseName[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const phases = [...context.configuration.phases].sort((left, right) => left.order - right.order);
    let stopped = false;

    for (const phaseConfiguration of phases) {
      if (stopped || !phaseConfiguration.enabled) {
        const message = stopped
          ? 'Phase ignorée après une erreur précédente.'
          : 'Phase désactivée par la configuration.';
        phaseReports.push(this.createSkippedReport(phaseConfiguration.name, message));
        skippedSteps.push(phaseConfiguration.name);
        continue;
      }

      const phase = phaseConfiguration.name;
      executedSteps.push(phase);
      context.currentPhase = phase;
      const phaseStartedAt = this.now();
      context.timestamps.currentPhaseStartedAt = phaseStartedAt.toISOString();
      this.logger.phaseStarted(context, phase);
      this.events.emit({
        type: 'phase:start',
        packageId: context.package.id,
        phase,
        timestamp: phaseStartedAt.toISOString(),
      });

      let outcome: PublisherPhaseOutcome<TResult>;
      try {
        const handler = this.handlers.get(phase);
        if (!handler) throw new PublisherPhaseHandlerNotFoundError(phase);
        outcome = await handler(context, phase);
        if (!this.isOutcome(outcome)) {
          throw new TypeError(`Résultat invalide retourné par la phase ${phase}.`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outcome = { status: 'ERROR', message, errors: [message] };
        this.logger.executionError(context, message, phase);
      }

      if (outcome.result !== undefined) context.result = outcome.result;
      const phaseCompletedAt = this.now();
      const durationMs = Math.max(0, phaseCompletedAt.getTime() - phaseStartedAt.getTime());
      context.timestamps.lastPhaseCompletedAt = phaseCompletedAt.toISOString();
      this.logger.phaseCompleted(context, phase, outcome, durationMs);

      const report: PublisherPhaseReport<TResult> = {
        phase,
        status: outcome.status,
        startedAt: phaseStartedAt.toISOString(),
        completedAt: phaseCompletedAt.toISOString(),
        durationMs,
        message: outcome.message,
        result: outcome.result,
        warnings: [...(outcome.warnings || [])],
        errors: [...(outcome.errors || [])],
      };
      phaseReports.push(report);
      warnings.push(...report.warnings);
      errors.push(...report.errors);
      if (outcome.status === 'WARNING' && outcome.message) warnings.push(outcome.message);
      if (outcome.status === 'ERROR') {
        if (report.errors.length === 0 && outcome.message) errors.push(outcome.message);
        stopped = context.configuration.stopOnError;
      }

      this.events.emit({
        type: 'phase:end',
        packageId: context.package.id,
        phase,
        timestamp: phaseCompletedAt.toISOString(),
        status: outcome.status,
      });
    }

    context.currentPhase = undefined;
    context.timestamps.currentPhaseStartedAt = undefined;
    const completedAtDate = this.now();
    const completedAt = completedAtDate.toISOString();
    context.timestamps.completedAt = completedAt;
    const durationMs = Math.max(0, completedAtDate.getTime() - startedAtDate.getTime());
    const status = errors.length > 0
      ? 'ERROR'
      : phaseReports.some(report => report.status === 'WARNING')
        ? 'WARNING'
        : 'SUCCESS';
    this.logger.publisherCompleted(context, status, durationMs);
    this.events.emit({
      type: 'publisher:end',
      packageId: context.package.id,
      timestamp: completedAt,
      status,
    });

    return {
      packageId: context.package.id,
      status,
      startedAt,
      completedAt,
      durationMs,
      phases: phaseReports,
      executedSteps,
      skippedSteps,
      errors,
      warnings,
      result: context.result,
      logs: [...context.logs],
    };
  }

  private createSkippedReport(
    phase: PublisherPhaseName,
    message: string,
  ): PublisherPhaseReport<TResult> {
    const timestamp = this.now().toISOString();
    return {
      phase,
      status: 'SKIPPED',
      startedAt: timestamp,
      completedAt: timestamp,
      durationMs: 0,
      message,
      warnings: [],
      errors: [],
    };
  }

  private isOutcome(value: unknown): value is PublisherPhaseOutcome<TResult> {
    if (typeof value !== 'object' || value === null) return false;
    const status = (value as { status?: unknown }).status;
    return typeof status === 'string'
      && (PUBLISHER_PHASE_RESULTS as readonly string[]).includes(status);
  }
}
