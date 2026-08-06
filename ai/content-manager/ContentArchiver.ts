import type { ContentPackage } from "../types/ContentPackage";
import { ContentArchiveStateError, ContentNotFoundError } from "./ContentErrors";
import type { ContentMemoryStore } from "./ContentSaver";

/** Déplace les packages entre les collections actives et archivées en mémoire. */
export class ContentArchiver {
  public constructor(private readonly store: ContentMemoryStore) {}

  public archive(contentId: string): ContentPackage {
    const content = this.store.active.get(contentId);
    if (!content) {
      if (this.store.archived.has(contentId)) {
        throw new ContentArchiveStateError(contentId, "déjà archivé");
      }
      throw new ContentNotFoundError(contentId);
    }
    this.store.active.delete(contentId);
    this.store.archived.set(contentId, structuredClone(content));
    return structuredClone(content);
  }

  public restore(contentId: string): ContentPackage {
    const content = this.store.archived.get(contentId);
    if (!content) {
      if (this.store.active.has(contentId)) {
        throw new ContentArchiveStateError(contentId, "déjà actif");
      }
      throw new ContentNotFoundError(contentId);
    }
    this.store.archived.delete(contentId);
    this.store.active.set(contentId, structuredClone(content));
    return structuredClone(content);
  }
}
