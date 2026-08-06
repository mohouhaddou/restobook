import { randomUUID } from "node:crypto";
import type { IntegrationAdapter } from "../adapters/BaseAdapter";
import type { ContentPackage, EditorId } from "../types";
import { ContentImporter } from "./ContentImporter";
import type {
  IntegrationContext,
  IntegrationReceipt,
} from "./IntegrationContext";
import {
  IntegrationReceiptNotFoundError,
  IntegrationValidationError,
} from "./IntegrationErrors";
import { IntegrationEventBus, type IntegrationEventType } from "./IntegrationEvents";
import { IntegrationLogger } from "./IntegrationLogger";
import { IntegrationRegistry } from "./IntegrationRegistry";
import {
  IntegrationValidator,
  type IntegrationValidationResult,
} from "./IntegrationValidator";

export interface IntegrationEngineOptions {
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
  readonly registry?: IntegrationRegistry;
  readonly logger?: IntegrationLogger;
  readonly events?: IntegrationEventBus;
}

/**
 * Orchestre la préparation d'un package pour un adapter.
 * Aucun appel externe ni publication n'est réalisé.
 */
export class IntegrationEngine {
  public readonly registry: IntegrationRegistry;
  public readonly logger: IntegrationLogger;
  public readonly events: IntegrationEventBus;

  private readonly receipts = new Map<string, IntegrationReceipt>();
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly importer = new ContentImporter();
  private readonly validator = new IntegrationValidator(this.importer);

  public constructor(options: IntegrationEngineOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.registry = options.registry ?? new IntegrationRegistry();
    this.logger = options.logger ?? new IntegrationLogger(this.now);
    this.events = options.events ?? new IntegrationEventBus();
  }

  public registerAdapter(adapter: IntegrationAdapter): void {
    this.registry.register(adapter);
  }

  public getAdapter(adapterId: EditorId): IntegrationAdapter {
    return this.registry.get(adapterId);
  }

  public listAdapters(): readonly IntegrationAdapter[] {
    return this.registry.list();
  }

  public validate(
    content: ContentPackage,
    adapterId: EditorId = content.editor,
  ): IntegrationValidationResult {
    const generic = this.validator.validate(content, adapterId);
    if (!generic.valid) return generic;
    const adapter = this.getAdapter(adapterId);
    const prepared = this.importer.prepare(content);
    const context = this.createContext(this.idGenerator(), adapter, prepared.package);
    const adapterValidation = adapter.validate(context);
    return {
      valid: adapterValidation.valid,
      errors: adapterValidation.errors,
      warnings: [...generic.warnings, ...adapterValidation.warnings],
    };
  }

  /** Prépare un artefact et retourne un reçu réversible conservé en mémoire. */
  public import(
    content: ContentPackage,
    adapterId: EditorId = content.editor,
  ): IntegrationReceipt {
    const adapter = this.getAdapter(adapterId);
    const integrationId = this.idGenerator();
    this.record("integration:start", integrationId, content, adapterId, "Préparation démarrée.");
    const validation = this.validator.validate(content, adapterId);
    if (!validation.valid) {
      this.record("integration:error", integrationId, content, adapterId, validation.errors.join("; "));
      throw new IntegrationValidationError(validation.errors);
    }
    this.record("integration:validated", integrationId, content, adapterId, "Package validé.");
    const prepared = this.importer.prepare(content);
    const context = this.createContext(integrationId, adapter, prepared.package);
    const adapterValidation = adapter.validate(context);
    if (!adapterValidation.valid) {
      throw new IntegrationValidationError(adapterValidation.errors);
    }
    const artifact = adapter.prepare(context);
    const receipt: IntegrationReceipt = {
      id: integrationId,
      artifact,
      status: "PREPARED",
    };
    this.receipts.set(receipt.id, structuredClone(receipt));
    this.record("integration:prepared", integrationId, content, adapterId, "Artefact préparé.");
    this.record("integration:completed", integrationId, content, adapterId, "Intégration terminée.");
    return structuredClone(receipt);
  }

  /** Annule uniquement le reçu en mémoire ; aucun système externe n'est modifié. */
  public rollback(receiptId: string): IntegrationReceipt {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) throw new IntegrationReceiptNotFoundError(receiptId);
    if (receipt.status === "ROLLED_BACK") return structuredClone(receipt);
    const adapter = this.getAdapter(receipt.artifact.adapterId);
    const rolledBack = adapter.rollback(receipt, this.now().toISOString());
    this.receipts.set(receiptId, structuredClone(rolledBack));
    this.record(
      "integration:rollback",
      receiptId,
      receipt.artifact.content,
      receipt.artifact.adapterId,
      "Préparation annulée.",
    );
    return structuredClone(rolledBack);
  }

  private createContext(
    integrationId: string,
    adapter: IntegrationAdapter,
    content: ContentPackage,
  ): IntegrationContext {
    const prepared = this.importer.prepare(content);
    return {
      integrationId,
      adapterId: adapter.id,
      package: prepared.package,
      assets: prepared.images.assets,
      targetProduct: adapter.targetProduct,
      createdAt: this.now().toISOString(),
    };
  }

  private record(
    event: IntegrationEventType,
    integrationId: string,
    content: ContentPackage,
    adapterId: EditorId,
    message: string,
  ): void {
    const timestamp = this.now().toISOString();
    this.logger.log({
      level: event === "integration:error" ? "error" : "info",
      event,
      integrationId,
      packageId: content.id,
      message,
    });
    this.events.emit({
      type: event,
      integrationId,
      packageId: content.id,
      adapterId,
      timestamp,
      message,
    });
  }
}
