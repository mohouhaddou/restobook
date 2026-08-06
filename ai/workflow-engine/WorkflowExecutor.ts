import type { WorkflowContext } from './WorkflowContext';
import { WorkflowStepHandlerNotFoundError } from './WorkflowErrors';
import {
  STEP_RESULTS,
  type WorkflowDefinition,
  type WorkflowExecutionReport,
  type WorkflowStepDefinition,
  type WorkflowStepHandler,
  type WorkflowStepOutcome,
  type WorkflowStepReport,
  WorkflowEventBus,
} from './WorkflowEvents';
import { WorkflowLogger, type WorkflowClock } from './WorkflowLogger';

/**
 * Exécuteur séquentiel générique.
 *
 * Il ne réalise aucune action métier : chaque type d’étape est associé à un
 * handler injecté par l’appelant.
 */
export class WorkflowExecutor<
  TPackage = unknown,
  TMetadata extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> {
  private readonly handlers = new Map<string, WorkflowStepHandler<TPackage, TMetadata>>();

  constructor(
    private readonly logger: WorkflowLogger = new WorkflowLogger(),
    private readonly events: WorkflowEventBus = new WorkflowEventBus(),
    private readonly now: WorkflowClock = () => new Date(),
  ) {}

  /** Enregistre ou remplace le handler d’un type d’étape. */
  registerHandler(type: string, handler: WorkflowStepHandler<TPackage, TMetadata>): void {
    if (!type.trim()) throw new TypeError('Le type de handler doit être une chaîne non vide.');
    this.handlers.set(type, handler);
  }

  /** Retire le handler d’un type d’étape. */
  unregisterHandler(type: string): boolean {
    return this.handlers.delete(type);
  }

  /** Indique si un handler peut exécuter le type demandé. */
  hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }

  /** Retourne le bus d’événements observable de l’exécuteur. */
  get eventBus(): WorkflowEventBus {
    return this.events;
  }

  /** Exécute les étapes dans l’ordre et produit un rapport complet. */
  async execute(
    workflow: WorkflowDefinition,
    context: WorkflowContext<TPackage, TMetadata>,
  ): Promise<WorkflowExecutionReport> {
    const startedAtDate = this.now();
    const startedAt = startedAtDate.toISOString();
    context.timestamps.startedAt = startedAt;
    context.timestamps.completedAt = undefined;
    this.logger.workflowStarted(context, workflow);
    this.events.emit({ type: 'workflow:start', workflowId: workflow.id, timestamp: startedAt });

    const reports: WorkflowStepReport[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const orderedSteps = [...workflow.steps].sort((left, right) => left.order - right.order);
    let stopped = false;

    for (const step of orderedSteps) {
      if (stopped) {
        reports.push(this.createSkippedReport(step, 'Workflow arrêté après une erreur.'));
        continue;
      }

      context.currentStep = step;
      const stepStartedAt = this.now();
      context.timestamps.currentStepStartedAt = stepStartedAt.toISOString();
      this.logger.stepStarted(context, step);
      this.events.emit({
        type: 'step:start',
        workflowId: workflow.id,
        stepId: step.id,
        timestamp: stepStartedAt.toISOString(),
      });

      let outcome: WorkflowStepOutcome;
      if (step.enabled === false) {
        outcome = { status: 'SKIPPED', message: 'Étape désactivée par la définition.' };
      } else {
        try {
          const handler = this.handlers.get(step.type);
          if (!handler) throw new WorkflowStepHandlerNotFoundError(step.type);
          outcome = await handler(context, step);
          if (!this.isOutcome(outcome)) {
            throw new TypeError(`Résultat invalide retourné par l’étape ${step.id}.`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          outcome = { status: 'ERROR', message, errors: [message] };
          this.logger.executionError(context, message, step.id);
        }
      }

      const stepCompletedAt = this.now();
      const durationMs = Math.max(0, stepCompletedAt.getTime() - stepStartedAt.getTime());
      context.timestamps.lastStepCompletedAt = stepCompletedAt.toISOString();
      this.logger.stepCompleted(context, step, outcome, durationMs);

      const report: WorkflowStepReport = {
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
        status: outcome.status,
        startedAt: stepStartedAt.toISOString(),
        completedAt: stepCompletedAt.toISOString(),
        durationMs,
        message: outcome.message,
        output: outcome.output,
        warnings: [...(outcome.warnings || [])],
        errors: [...(outcome.errors || [])],
      };
      reports.push(report);
      warnings.push(...report.warnings);
      errors.push(...report.errors);
      if (outcome.status === 'WARNING' && outcome.message) warnings.push(outcome.message);
      if (outcome.status === 'ERROR') {
        if (report.errors.length === 0 && outcome.message) errors.push(outcome.message);
        stopped = true;
      }

      this.events.emit({
        type: 'step:end',
        workflowId: workflow.id,
        stepId: step.id,
        timestamp: stepCompletedAt.toISOString(),
        status: outcome.status,
      });
    }

    context.currentStep = undefined;
    context.timestamps.currentStepStartedAt = undefined;
    const completedAtDate = this.now();
    const completedAt = completedAtDate.toISOString();
    context.timestamps.completedAt = completedAt;
    const durationMs = Math.max(0, completedAtDate.getTime() - startedAtDate.getTime());
    const status = errors.length > 0
      ? 'ERROR'
      : reports.some(report => report.status === 'WARNING')
        ? 'WARNING'
        : 'SUCCESS';

    this.logger.workflowCompleted(context, workflow, status, durationMs);
    this.events.emit({ type: 'workflow:end', workflowId: workflow.id, timestamp: completedAt, status });

    return {
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      status,
      startedAt,
      completedAt,
      durationMs,
      steps: reports,
      warnings,
      errors,
      logs: [...context.logs],
    };
  }

  private createSkippedReport(step: WorkflowStepDefinition, message: string): WorkflowStepReport {
    const timestamp = this.now().toISOString();
    return {
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      status: 'SKIPPED',
      startedAt: timestamp,
      completedAt: timestamp,
      durationMs: 0,
      message,
      warnings: [],
      errors: [],
    };
  }

  private isOutcome(value: unknown): value is WorkflowStepOutcome {
    if (typeof value !== 'object' || value === null) return false;
    const status = (value as { status?: unknown }).status;
    return typeof status === 'string' && (STEP_RESULTS as readonly string[]).includes(status);
  }
}
