/** Erreur racine du Content Package Manager. */
export class ContentManagerError extends Error {
  /** Code stable exploitable par les appelants. */
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ContentManagerError';
    this.code = code;
  }
}

/** Erreur levée lorsqu’un paquet est absent. */
export class ContentNotFoundError extends ContentManagerError {
  constructor(contentId: string) {
    super('CONTENT_NOT_FOUND', `ContentPackage introuvable : ${contentId}`);
    this.name = 'ContentNotFoundError';
  }
}

/** Erreur levée lors de la création d’un identifiant existant. */
export class ContentAlreadyExistsError extends ContentManagerError {
  constructor(contentId: string) {
    super('CONTENT_ALREADY_EXISTS', `ContentPackage déjà existant : ${contentId}`);
    this.name = 'ContentAlreadyExistsError';
  }
}

/** Erreur levée lorsqu’un paquet ne respecte pas le contrat. */
export class ContentValidationError extends ContentManagerError {
  /** Erreurs structurelles complètes. */
  readonly validationErrors: readonly string[];

  constructor(errors: readonly string[]) {
    super('CONTENT_VALIDATION_FAILED', `ContentPackage invalide : ${errors.join('; ')}`);
    this.name = 'ContentValidationError';
    this.validationErrors = [...errors];
  }
}

/** Erreur levée lorsqu’une version est absente de l’historique. */
export class ContentVersionNotFoundError extends ContentManagerError {
  constructor(contentId: string, version: string) {
    super('CONTENT_VERSION_NOT_FOUND', `Version ${version} introuvable pour ${contentId}.`);
    this.name = 'ContentVersionNotFoundError';
  }
}

/** Erreur levée lors d’une transition archive/restauration invalide. */
export class ContentArchiveStateError extends ContentManagerError {
  constructor(contentId: string, message: string) {
    super('CONTENT_ARCHIVE_STATE_INVALID', `${contentId} : ${message}`);
    this.name = 'ContentArchiveStateError';
  }
}
