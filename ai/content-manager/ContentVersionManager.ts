import type { ContentPackage } from '../types';
import { ContentVersionNotFoundError } from './ContentErrors';
import type { ContentClock } from './ContentLogger';

/** Snapshot immutable d’une version de contenu. */
export interface ContentVersion {
  /** Libellé séquentiel de version : `v1`, `v2`, etc. */
  readonly version: `v${number}`;
  /** Numéro entier de la version. */
  readonly number: number;
  /** Identifiant du paquet versionné. */
  readonly contentId: string;
  /** Date ISO 8601 de création de la version. */
  readonly createdAt: string;
  /** Snapshot complet du paquet. */
  readonly package: ContentPackage;
}

/** Gestionnaire en mémoire des versions de `ContentPackage`. */
export class ContentVersionManager {
  private readonly versions = new Map<string, ContentVersion[]>();

  constructor(private readonly now: ContentClock = () => new Date()) {}

  /** Crée automatiquement la version séquentielle suivante. */
  createVersion(contentPackage: ContentPackage): ContentVersion {
    const history = this.versions.get(contentPackage.id) || [];
    const number = history.length + 1;
    const record: ContentVersion = {
      version: `v${number}`,
      number,
      contentId: contentPackage.id,
      createdAt: this.now().toISOString(),
      package: structuredClone(contentPackage),
    };
    history.push(record);
    this.versions.set(contentPackage.id, history);
    return this.clone(record);
  }

  /** Retourne une version précise. */
  get(contentId: string, version: string): ContentVersion {
    const record = (this.versions.get(contentId) || [])
      .find(candidate => candidate.version === version);
    if (!record) throw new ContentVersionNotFoundError(contentId, version);
    return this.clone(record);
  }

  /** Retourne la version la plus récente. */
  latest(contentId: string): ContentVersion {
    const history = this.versions.get(contentId) || [];
    const record = history.at(-1);
    if (!record) throw new ContentVersionNotFoundError(contentId, 'latest');
    return this.clone(record);
  }

  /** Liste l’historique complet dans l’ordre chronologique. */
  list(contentId: string): readonly ContentVersion[] {
    return (this.versions.get(contentId) || []).map(record => this.clone(record));
  }

  /** Indique si une version précise existe. */
  has(contentId: string, version: string): boolean {
    return (this.versions.get(contentId) || []).some(record => record.version === version);
  }

  private clone(record: ContentVersion): ContentVersion {
    return structuredClone(record);
  }
}
