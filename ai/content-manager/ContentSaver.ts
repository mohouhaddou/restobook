import type { ContentPackage } from '../types';

/** État en mémoire partagé par le loader, le saver et l’archiver. */
export interface ContentMemoryStore {
  /** Paquets actifs indexés par identifiant. */
  readonly active: Map<string, ContentPackage>;
  /** Paquets archivés indexés par identifiant. */
  readonly archived: Map<string, ContentPackage>;
}

/** Crée un stockage vide sans accès externe. */
export function createContentMemoryStore(): ContentMemoryStore {
  return {
    active: new Map<string, ContentPackage>(),
    archived: new Map<string, ContentPackage>(),
  };
}

/** Sauvegarde de snapshots dans le stockage en mémoire. */
export class ContentSaver {
  constructor(readonly store: ContentMemoryStore = createContentMemoryStore()) {}

  /** Crée ou remplace le snapshot actif d’un paquet. */
  save(contentPackage: ContentPackage): ContentPackage {
    const snapshot = structuredClone(contentPackage);
    this.store.active.set(snapshot.id, snapshot);
    this.store.archived.delete(snapshot.id);
    return structuredClone(snapshot);
  }

  /** Supprime un paquet actif ou archivé. */
  delete(contentId: string): boolean {
    const activeDeleted = this.store.active.delete(contentId);
    const archivedDeleted = this.store.archived.delete(contentId);
    return activeDeleted || archivedDeleted;
  }
}
