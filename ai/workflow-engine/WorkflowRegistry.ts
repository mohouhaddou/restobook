import {
  WorkflowAlreadyRegisteredError,
  WorkflowNotFoundError,
} from './WorkflowErrors';
import type { WorkflowDefinition } from './WorkflowEvents';

/**
 * Registre en mémoire des définitions de workflows.
 *
 * Il ne charge aucun fichier et ne connaît aucun éditeur. Le cycle de vie des
 * définitions reste sous le contrôle de l’appelant.
 */
export class WorkflowRegistry {
  private readonly workflows = new Map<string, WorkflowDefinition>();

  /** Enregistre une nouvelle définition. */
  register(workflow: WorkflowDefinition): void {
    if (this.workflows.has(workflow.id)) {
      throw new WorkflowAlreadyRegisteredError(workflow.id);
    }
    this.workflows.set(workflow.id, workflow);
  }

  /** Retire et retourne une définition, ou `undefined` si elle est absente. */
  unregister(workflowId: string): WorkflowDefinition | undefined {
    const workflow = this.workflows.get(workflowId);
    this.workflows.delete(workflowId);
    return workflow;
  }

  /** Retourne une définition ou lève une erreur explicite. */
  get(workflowId: string): WorkflowDefinition {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new WorkflowNotFoundError(workflowId);
    return workflow;
  }

  /** Liste les définitions dans leur ordre d’enregistrement. */
  list(): readonly WorkflowDefinition[] {
    return [...this.workflows.values()];
  }

  /** Indique si un identifiant est enregistré. */
  has(workflowId: string): boolean {
    return this.workflows.has(workflowId);
  }
}
