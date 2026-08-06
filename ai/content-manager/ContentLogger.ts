import type { ContentEventType } from './ContentEvents';

/** Niveau d’une entrée de journal du gestionnaire. */
export type ContentLogLevel = 'info' | 'warning' | 'error';

/** Entrée structurée conservée uniquement en mémoire. */
export interface ContentLogEntry {
  /** Date ISO 8601 de l’entrée. */
  readonly timestamp: string;
  /** Niveau de sévérité. */
  readonly level: ContentLogLevel;
  /** Opération concernée. */
  readonly operation: ContentEventType | 'content:validated' | 'content:normalized';
  /** Identifiant du paquet. */
  readonly contentId: string;
  /** Message lisible. */
  readonly message: string;
  /** Version concernée, le cas échéant. */
  readonly version?: string;
}

/** Horloge injectable du gestionnaire. */
export type ContentClock = () => Date;

/** Journal en mémoire des opérations du Content Manager. */
export class ContentLogger {
  private readonly entries: ContentLogEntry[] = [];

  constructor(private readonly now: ContentClock = () => new Date()) {}

  /** Ajoute une entrée au journal. */
  log(
    level: ContentLogLevel,
    operation: ContentLogEntry['operation'],
    contentId: string,
    message: string,
    version?: string,
  ): ContentLogEntry {
    const entry: ContentLogEntry = {
      timestamp: this.now().toISOString(),
      level,
      operation,
      contentId,
      message,
      version,
    };
    this.entries.push(entry);
    return entry;
  }

  /** Retourne un snapshot immutable du journal. */
  list(contentId?: string): readonly ContentLogEntry[] {
    return this.entries
      .filter(entry => !contentId || entry.contentId === contentId)
      .map(entry => ({ ...entry }));
  }
}
