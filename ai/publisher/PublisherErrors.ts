/** Erreur racine du Publisher Engine. */
export class PublisherError extends Error {
  /** Code stable de l’erreur. */
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PublisherError';
    this.code = code;
  }
}

/** Erreur levée lorsque le contexte ou le paquet est invalide. */
export class PublisherValidationError extends PublisherError {
  /** Erreurs de validation complètes. */
  readonly validationErrors: readonly string[];

  constructor(errors: readonly string[]) {
    super('PUBLISHER_VALIDATION_FAILED', `Validation Publisher échouée : ${errors.join('; ')}`);
    this.name = 'PublisherValidationError';
    this.validationErrors = [...errors];
  }
}

/** Erreur levée lorsqu’une phase active ne possède aucun handler. */
export class PublisherPhaseHandlerNotFoundError extends PublisherError {
  constructor(phase: string) {
    super('PUBLISHER_PHASE_HANDLER_NOT_FOUND', `Handler introuvable pour la phase : ${phase}`);
    this.name = 'PublisherPhaseHandlerNotFoundError';
  }
}
