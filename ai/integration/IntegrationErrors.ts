/** Erreur racine stable de la couche d'intégration. */
export class IntegrationError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "IntegrationError";
  }
}

export class AdapterNotFoundError extends IntegrationError {
  public constructor(adapterId: string) {
    super("ADAPTER_NOT_FOUND", `Adapter introuvable : ${adapterId}.`);
    this.name = "AdapterNotFoundError";
  }
}

export class AdapterAlreadyRegisteredError extends IntegrationError {
  public constructor(adapterId: string) {
    super("ADAPTER_ALREADY_REGISTERED", `Adapter déjà enregistré : ${adapterId}.`);
    this.name = "AdapterAlreadyRegisteredError";
  }
}

export class IntegrationValidationError extends IntegrationError {
  public constructor(public readonly validationErrors: readonly string[]) {
    super("INTEGRATION_VALIDATION_FAILED", validationErrors.join("; "));
    this.name = "IntegrationValidationError";
  }
}

export class IntegrationReceiptNotFoundError extends IntegrationError {
  public constructor(receiptId: string) {
    super("INTEGRATION_RECEIPT_NOT_FOUND", `Reçu d'intégration introuvable : ${receiptId}.`);
    this.name = "IntegrationReceiptNotFoundError";
  }
}
