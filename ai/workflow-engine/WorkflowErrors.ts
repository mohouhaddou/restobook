/** Erreur racine du moteur de workflows. */
export class WorkflowEngineError extends Error {
  /** Code stable exploitable par un appelant. */
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WorkflowEngineError';
    this.code = code;
  }
}

/** Erreur levée lorsqu’une définition est invalide. */
export class WorkflowValidationError extends WorkflowEngineError {
  /** Liste complète des erreurs de validation. */
  readonly validationErrors: readonly string[];

  constructor(errors: readonly string[]) {
    super('WORKFLOW_INVALID', `Workflow invalide : ${errors.join('; ')}`);
    this.name = 'WorkflowValidationError';
    this.validationErrors = [...errors];
  }
}

/** Erreur levée lorsqu’un workflow est absent du registre. */
export class WorkflowNotFoundError extends WorkflowEngineError {
  constructor(workflowId: string) {
    super('WORKFLOW_NOT_FOUND', `Workflow introuvable : ${workflowId}`);
    this.name = 'WorkflowNotFoundError';
  }
}

/** Erreur levée lors d’un enregistrement en double. */
export class WorkflowAlreadyRegisteredError extends WorkflowEngineError {
  constructor(workflowId: string) {
    super('WORKFLOW_ALREADY_REGISTERED', `Workflow déjà enregistré : ${workflowId}`);
    this.name = 'WorkflowAlreadyRegisteredError';
  }
}

/** Erreur levée lorsqu’aucun handler ne correspond à une étape. */
export class WorkflowStepHandlerNotFoundError extends WorkflowEngineError {
  constructor(stepType: string) {
    super('STEP_HANDLER_NOT_FOUND', `Handler introuvable pour le type d’étape : ${stepType}`);
    this.name = 'WorkflowStepHandlerNotFoundError';
  }
}
