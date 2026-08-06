import type { ContentPackage } from "../types/ContentPackage";
import { ContentArchiver } from "./ContentArchiver";
import type { ContentComparison } from "./ContentComparer";
import { ContentComparer } from "./ContentComparer";
import {
  ContentAlreadyExistsError,
  ContentNotFoundError,
  ContentValidationError,
} from "./ContentErrors";
import { ContentEventBus } from "./ContentEvents";
import { ContentHistory } from "./ContentHistory";
import { ContentLoader } from "./ContentLoader";
import { ContentLogger, type ContentClock } from "./ContentLogger";
import { ContentNormalizer } from "./ContentNormalizer";
import { ContentSaver, createContentMemoryStore } from "./ContentSaver";
import {
  ContentStatistics,
  type ContentStatisticsReport,
} from "./ContentStatistics";
import { ContentValidator, type ContentValidationResult } from "./ContentValidator";
import {
  ContentVersionManager,
  type ContentVersion,
} from "./ContentVersionManager";

/** Dépendances optionnelles permettant d'adapter le gestionnaire sans couplage externe. */
export interface ContentManagerOptions {
  readonly now?: ContentClock;
  readonly events?: ContentEventBus;
  readonly logger?: ContentLogger;
}

/** Paramètres d'une duplication de package. */
export interface ContentDuplicateOptions {
  readonly id: string;
  readonly slug?: string;
}

/**
 * Façade centrale des opérations de cycle de vie d'un `ContentPackage`.
 * Toutes les données sont conservées en mémoire et retournées sous forme de snapshots.
 */
export class ContentManager {
  public readonly events: ContentEventBus;
  public readonly logger: ContentLogger;

  private readonly now: ContentClock;
  private readonly saver: ContentSaver;
  private readonly loader: ContentLoader;
  private readonly archiver: ContentArchiver;
  private readonly validator = new ContentValidator();
  private readonly normalizer: ContentNormalizer;
  private readonly versions: ContentVersionManager;
  private readonly contentHistory: ContentHistory;
  private readonly comparer = new ContentComparer();
  private readonly statisticCalculator = new ContentStatistics();

  public constructor(options: ContentManagerOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.events = options.events ?? new ContentEventBus();
    this.logger = options.logger ?? new ContentLogger(this.now);
    const store = createContentMemoryStore();
    this.saver = new ContentSaver(store);
    this.loader = new ContentLoader(store);
    this.archiver = new ContentArchiver(store);
    this.normalizer = new ContentNormalizer({ now: this.now });
    this.versions = new ContentVersionManager(this.now);
    this.contentHistory = new ContentHistory(this.versions);
  }

  /** Crée un nouveau package actif et sa version `v1`. */
  public create(content: ContentPackage): ContentVersion {
    if (this.loader.has(content.id) || this.loader.isArchived(content.id)) {
      throw new ContentAlreadyExistsError(content.id);
    }
    const normalized = this.normalize(content);
    this.assertValid(normalized);
    this.saver.save(normalized);
    const version = this.versions.createVersion(normalized);
    this.record("content:created", normalized.id, "ContentPackage créé.", version.version);
    return version;
  }

  /** Charge la version active ou une version historique précise. */
  public load(contentId: string, version?: string): ContentPackage {
    return version
      ? this.contentHistory.get(contentId, version)
      : this.loader.load(contentId);
  }

  /** Sauvegarde un package actif et crée automatiquement la version suivante. */
  public save(content: ContentPackage): ContentVersion {
    if (!this.loader.has(content.id)) throw new ContentNotFoundError(content.id);
    const normalized = this.normalize(content);
    this.assertValid(normalized);
    this.saver.save(normalized);
    const version = this.versions.createVersion(normalized);
    this.record("content:saved", normalized.id, "ContentPackage sauvegardé.", version.version);
    return version;
  }

  /** Valide un package sans le modifier ni le sauvegarder. */
  public validate(content: ContentPackage): ContentValidationResult {
    const result = this.validator.validate(content);
    this.logger.log(
      result.valid ? "info" : "error",
      "content:validated",
      content.id,
      result.valid ? "Validation réussie." : result.errors.join("; "),
    );
    return result;
  }

  /** Retourne une copie normalisée sans la sauvegarder. */
  public normalize(content: ContentPackage): ContentPackage {
    const normalized = this.normalizer.normalize(content);
    this.logger.log("info", "content:normalized", content.id, "Normalisation terminée.");
    return normalized;
  }

  /** Archive un package actif. */
  public archive(contentId: string): ContentPackage {
    const content = this.archiver.archive(contentId);
    this.record("content:archived", contentId, "ContentPackage archivé.");
    return content;
  }

  /** Restaure un package archivé. */
  public restore(contentId: string): ContentPackage {
    const content = this.archiver.restore(contentId);
    this.record("content:restored", contentId, "ContentPackage restauré.");
    return content;
  }

  /** Duplique un package dans un nouvel identifiant et démarre son historique à `v1`. */
  public duplicate(
    sourceContentId: string,
    options: ContentDuplicateOptions,
  ): ContentVersion {
    const source = this.loader.load(sourceContentId);
    const timestamp = this.now().toISOString();
    const duplicate: ContentPackage = {
      ...structuredClone(source),
      id: options.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {
        ...source.metadata,
        slug: options.slug ?? `${source.metadata.slug}-copy`,
      },
    };
    const created = this.create(duplicate);
    this.record(
      "content:duplicated",
      options.id,
      `ContentPackage dupliqué depuis ${sourceContentId}.`,
      created.version,
      sourceContentId,
    );
    return created;
  }

  /** Compare deux versions historiques d'un même package. */
  public compare(
    contentId: string,
    beforeVersion: string,
    afterVersion: string,
  ): ContentComparison {
    return this.comparer.compare(
      this.contentHistory.get(contentId, beforeVersion),
      this.contentHistory.get(contentId, afterVersion),
    );
  }

  /** Supprime le snapshot actif ou archivé ; l'historique reste consultable. */
  public delete(contentId: string): void {
    if (!this.saver.delete(contentId)) throw new ContentNotFoundError(contentId);
    this.record("content:deleted", contentId, "ContentPackage supprimé.");
  }

  /** Liste les packages actifs, avec inclusion facultative des archives. */
  public list(includeArchived = false): readonly ContentPackage[] {
    return this.loader.list(includeArchived);
  }

  /** Retourne l'historique complet des versions d'un package. */
  public history(contentId: string): readonly ContentVersion[] {
    return this.contentHistory.list(contentId);
  }

  /** Calcule les statistiques d'une version active ou historique. */
  public statistics(contentId: string, version?: string): ContentStatisticsReport {
    return this.statisticCalculator.calculate(this.load(contentId, version));
  }

  private assertValid(content: ContentPackage): void {
    const result = this.validate(content);
    if (!result.valid) throw new ContentValidationError(result.errors);
  }

  private record(
    operation: Parameters<ContentLogger["log"]>[1],
    contentId: string,
    message: string,
    version?: string,
    sourceContentId?: string,
  ): void {
    this.logger.log("info", operation, contentId, message, version);
    if (
      operation === "content:created"
      || operation === "content:saved"
      || operation === "content:archived"
      || operation === "content:restored"
      || operation === "content:duplicated"
      || operation === "content:deleted"
    ) {
      this.events.emit({
        type: operation,
        contentId,
        version,
        sourceContentId,
        timestamp: this.now().toISOString(),
      });
    }
  }
}
