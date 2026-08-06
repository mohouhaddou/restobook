import { randomUUID } from "node:crypto";
import type { ContentPackage, EditorId } from "../../../../ai/types";
import type { AiContentImporter } from "./importers/BaseImporter";
import {
  AiPublisherImporterNotFoundError,
  AiPublisherTransactionError,
  AiPublisherValidationError,
} from "./AiPublisherErrors";
import { AiPublisherEventBus, type AiPublisherEventType } from "./AiPublisherEvents";
import { AiPublisherLogger } from "./AiPublisherLogger";
import { AiPublisherRepository } from "./AiPublisherRepository";
import { AiPublisherValidator } from "./AiPublisherValidator";
import type { PublishError } from "./PublishError";
import type { PublishReport } from "./PublishReport";
import type { PublishResult } from "./PublishResult";

export interface AiPublisherServiceOptions {
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
  readonly logger?: AiPublisherLogger;
  readonly events?: AiPublisherEventBus;
}

/** Service applicatif transactionnel, sans accès direct aux modèles. */
export class AiPublisherService {
  public readonly logger: AiPublisherLogger;
  public readonly events: AiPublisherEventBus;
  private readonly importers = new Map<EditorId, AiContentImporter>();
  private readonly now: () => Date;
  private readonly idGenerator: () => string;

  public constructor(
    private readonly repository: AiPublisherRepository,
    private readonly validator = new AiPublisherValidator(),
    options: AiPublisherServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.logger = options.logger ?? new AiPublisherLogger(this.now);
    this.events = options.events ?? new AiPublisherEventBus();
  }

  public registerImporter(importer: AiContentImporter): void {
    this.importers.set(importer.editor, importer);
  }

  public getImporter(editor: EditorId): AiContentImporter {
    const importer = this.importers.get(editor);
    if (!importer) throw new AiPublisherImporterNotFoundError(editor);
    return importer;
  }

  /**
   * Valide, prépare et enregistre atomiquement le contenu.
   * Toute erreur postérieure à l'ouverture provoque un rollback complet.
   */
  public async publish(content: ContentPackage): Promise<PublishReport> {
    const operationId = this.idGenerator();
    const started = this.now();
    const warnings: string[] = [];
    const errors: PublishError[] = [];
    let transactionStatus: PublishReport["transactionStatus"] = "NOT_STARTED";
    let transaction: Awaited<ReturnType<AiPublisherRepository["createTransaction"]>> | undefined;
    this.record("publish:start", operationId, content, "Publication démarrée.");

    try {
      const validation = this.validator.validate(content);
      warnings.push(...validation.warnings);
      if (!validation.valid) throw new AiPublisherValidationError(validation.errors);
      this.record("publish:validated", operationId, content, "Package validé.");

      const importer = this.getImporter(content.editor);
      const record = importer.prepare(content);
      this.record("publish:prepared", operationId, content, "Données préparées.");

      transaction = await this.repository.createTransaction();
      this.record("transaction:start", operationId, content, transaction.id);
      const persisted = await transaction.save(record);
      await transaction.commit();
      transactionStatus = "COMMITTED";
      this.record("transaction:commit", operationId, content, transaction.id);

      const result: PublishResult = {
        operationId,
        packageId: content.id,
        editor: content.editor,
        target: importer.target,
        recordId: persisted.id,
        publishedAt: this.now().toISOString(),
      };
      this.record("publish:success", operationId, content, "Publication réussie.");
      return this.report(
        operationId,
        content.id,
        started,
        transactionStatus,
        warnings,
        errors,
        result,
      );
    } catch (error) {
      if (transaction) {
        try {
          await transaction.rollback();
          transactionStatus = "ROLLED_BACK";
          this.record("transaction:rollback", operationId, content, transaction.id);
        } catch (rollbackError) {
          errors.push({
            code: "ROLLBACK_FAILED",
            message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
            phase: "transaction",
          });
        }
      }
      const publishError = this.toPublishError(error);
      errors.unshift(publishError);
      this.record("publish:error", operationId, content, publishError.message);
      return this.report(
        operationId,
        content.id,
        started,
        transactionStatus,
        warnings,
        errors,
      );
    }
  }

  private report(
    operationId: string,
    packageId: string,
    started: Date,
    transactionStatus: PublishReport["transactionStatus"],
    warnings: readonly string[],
    errors: readonly PublishError[],
    result?: PublishResult,
  ): PublishReport {
    const finished = this.now();
    return {
      operationId,
      packageId,
      status: errors.length ? "ERROR" : "SUCCESS",
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
      durationMs: Math.max(0, finished.getTime() - started.getTime()),
      transactionStatus,
      result,
      errors: [...errors],
      warnings: [...warnings],
    };
  }

  private toPublishError(error: unknown): PublishError {
    if (error instanceof AiPublisherValidationError) {
      return { code: error.code, message: error.message, phase: "validation" };
    }
    if (error instanceof AiPublisherImporterNotFoundError) {
      return { code: error.code, message: error.message, phase: "preparation" };
    }
    const transactionError = error instanceof AiPublisherTransactionError
      ? error
      : new AiPublisherTransactionError(
        error instanceof Error ? error.message : String(error),
        error,
      );
    return { code: transactionError.code, message: transactionError.message, phase: "transaction" };
  }

  private record(
    type: AiPublisherEventType,
    operationId: string,
    content: ContentPackage,
    message: string,
  ): void {
    const level = type === "publish:error" ? "error" : "info";
    this.logger.log({ level, event: type, operationId, packageId: content.id, message });
    this.events.emit({
      type,
      operationId,
      packageId: content.id,
      editor: content.editor,
      timestamp: this.now().toISOString(),
      message,
    });
  }
}
