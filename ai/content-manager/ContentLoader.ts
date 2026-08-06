import type { ContentPackage } from '../types';
import { ContentNotFoundError } from './ContentErrors';
import type { ContentMemoryStore } from './ContentSaver';

/** Lecture de snapshots depuis un stockage en mémoire injecté. */
export class ContentLoader {
  constructor(private readonly store: ContentMemoryStore) {}

  /** Charge un paquet actif ou lève une erreur explicite. */
  load(contentId: string): ContentPackage {
    const contentPackage = this.store.active.get(contentId);
    if (!contentPackage) throw new ContentNotFoundError(contentId);
    return structuredClone(contentPackage);
  }

  /** Charge un paquet archivé ou lève une erreur explicite. */
  loadArchived(contentId: string): ContentPackage {
    const contentPackage = this.store.archived.get(contentId);
    if (!contentPackage) throw new ContentNotFoundError(contentId);
    return structuredClone(contentPackage);
  }

  /** Liste les paquets actifs, avec inclusion optionnelle des archives. */
  list(includeArchived = false): readonly ContentPackage[] {
    const packages = [...this.store.active.values()];
    if (includeArchived) packages.push(...this.store.archived.values());
    return packages
      .map(contentPackage => structuredClone(contentPackage))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  /** Indique si un paquet actif existe. */
  has(contentId: string): boolean {
    return this.store.active.has(contentId);
  }

  /** Indique si un paquet archivé existe. */
  isArchived(contentId: string): boolean {
    return this.store.archived.has(contentId);
  }
}
