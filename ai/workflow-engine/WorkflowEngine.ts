import type { WorkflowContext } from './WorkflowContext';
import { WorkflowValidationError } from './WorkflowErrors';
import type {
  WorkflowDefinition,
  WorkflowExecutionReport,
  WorkflowStepHandler,
} from './WorkflowEvents';
import { WorkflowExecutor } from './WorkflowExecutor';
import { WorkflowRegistry } from './WorkflowRegistry';
import {
  WorkflowValidator,
  type WorkflowValidationResult,
} from './WorkflowValidator';

/**
 * Façade générique réunissant registre, validation et exécution séquentielle.
 */
export class WorkflowEngine<
  TPackage = unknown,
  TMetadata extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> {
  constructor(
    readonly registry: WorkflowRegistry = new WorkflowRegistry(),
    readonly validator: WorkflowValidator = new WorkflowValidator(),
    readonly executor: WorkflowExecutor<TPackage, TMetadata> = new WorkflowExecutor<TPackage, TMetadata>(),
  ) {}

  /** Valide puis enregistre un workflow. */
  register(workflow: WorkflowDefinition): void {
    const result = this.validate(workflow, false);
    if (!result.valid) throw new WorkflowValidationError(result.errors);
    this.registry.register(workflow);
  }

  /** Charge un workflow depuis le registre. */
  load(workflowId: string): WorkflowDefinition {
    return this.registry.get(workflowId);
  }

  /** Valide une définition et, si demandé, la disponibilité de ses handlers. */
  validate(candidate: unknown, requireHandlers = true): WorkflowValidationResult {
    return this.validator.validate(
      candidate,
      requireHandlers ? type => this.executor.hasHandler(type) : undefined,
    );
  }

  /** Enregistre un handler générique pour un type d’étape. */
  registerStepHandler(type: string, handler: WorkflowStepHandler<TPackage, TMetadata>): void {
    this.executor.registerHandler(type, handler);
  }

  /** Exécute un workflow enregistré après validation complète. */
  async execute(
    workflowId: string,
    context: WorkflowContext<TPackage, TMetadata>,
  ): Promise<WorkflowExecutionReport> {
    const workflow = this.load(workflowId);
    const result = this.validate(workflow, true);
    if (!result.valid) throw new WorkflowValidationError(result.errors);
    return this.executor.execute(workflow, context);
  }
}
