/** Erreur racine du module backend AI Publisher. */
export class AiPublisherError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AiPublisherError";
  }
}

export class AiPublisherValidationError extends AiPublisherError {
  public constructor(public readonly validationErrors: readonly string[]) {
    super("AI_PUBLISHER_VALIDATION_FAILED", validationErrors.join("; "));
    this.name = "AiPublisherValidationError";
  }
}

export class AiPublisherImporterNotFoundError extends AiPublisherError {
  public constructor(editor: string) {
    super("AI_PUBLISHER_IMPORTER_NOT_FOUND", `Importer introuvable : ${editor}.`);
    this.name = "AiPublisherImporterNotFoundError";
  }
}

export class AiPublisherTransactionError extends AiPublisherError {
  public constructor(message: string, cause?: unknown) {
    super("AI_PUBLISHER_TRANSACTION_FAILED", message, { cause });
    this.name = "AiPublisherTransactionError";
  }
}
