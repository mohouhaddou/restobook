import type {
  WorkflowContext,
  WorkflowLogEntry,
  WorkflowLogEvent,
  WorkflowLogLevel,
} from './WorkflowContext';
import type {
  WorkflowDefinition,
  WorkflowReportStatus,
  WorkflowStepDefinition,
  WorkflowStepOutcome,
} from './WorkflowEvents';

/** Fabrique d’horodatage injectable pour rendre le moteur testable. */
export type WorkflowClock = () => Date;

/**
 * Journal structuré d’une exécution.
 *
 * Le logger n’écrit ni sur disque ni vers un service externe. Il enrichit
 * uniquement le tableau `context.logs`.
 */
export class WorkflowLogger {
  constructor(private readonly now: WorkflowClock = () => new Date()) {}

  /** Journalise le début d’un workflow. */
  workflowStarted(context: WorkflowContext, workflow: WorkflowDefinition): void {
    this.push(context, 'info', 'workflow:start', `Workflow ${workflow.id} démarré.`);
  }

  /** Journalise la fin et le résultat global d’un workflow. */
  workflowCompleted(
    context: WorkflowContext,
    workflow: WorkflowDefinition,
    status: WorkflowReportStatus,
    durationMs: number,
  ): void {
    this.push(context, status === 'ERROR' ? 'error' : status === 'WARNING' ? 'warning' : 'info', 'workflow:end', `Workflow ${workflow.id} terminé.`, {
      status,
      durationMs,
    });
  }

  /** Journalise le début d’une étape. */
  stepStarted(context: WorkflowContext, step: WorkflowStepDefinition): void {
    this.push(context, 'info', 'step:start', `Étape ${step.id} démarrée.`, undefined, step.id);
  }

  /** Journalise la fin, la durée et le résultat d’une étape. */
  stepCompleted(
    context: WorkflowContext,
    step: WorkflowStepDefinition,
    outcome: WorkflowStepOutcome,
    durationMs: number,
  ): void {
    const level: WorkflowLogLevel =
      outcome.status === 'ERROR' ? 'error' : outcome.status === 'WARNING' ? 'warning' : 'info';
    this.push(context, level, 'step:end', outcome.message || `Étape ${step.id} terminée.`, {
      status: outcome.status,
      durationMs,
      output: outcome.output,
    }, step.id);

    for (const warning of outcome.warnings || []) {
      this.push(context, 'warning', 'warning', warning, undefined, step.id);
    }
    for (const error of outcome.errors || []) {
      this.push(context, 'error', 'error', error, undefined, step.id);
    }
  }

  /** Journalise une erreur capturée par l’exécuteur. */
  executionError(context: WorkflowContext, message: string, stepId?: string): void {
    this.push(context, 'error', 'error', message, undefined, stepId);
  }

  /** Ajoute une entrée immuable au contexte. */
  private push(
    context: WorkflowContext,
    level: WorkflowLogLevel,
    event: WorkflowLogEvent,
    message: string,
    details?: Readonly<Record<string, unknown>>,
    stepId?: string,
  ): void {
    const entry: WorkflowLogEntry = {
      timestamp: this.now().toISOString(),
      level,
      event,
      message,
      stepId,
      details,
    };
    context.logs.push(entry);
  }
}
