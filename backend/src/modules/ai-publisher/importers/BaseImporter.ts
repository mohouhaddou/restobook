import type { ContentPackage, EditorId } from "../../../../../ai/types";
import type { AiPublisherRecord } from "../AiPublisherRepository";

/** Contrat commun aux cinq importers backend. */
export interface AiContentImporter {
  readonly editor: EditorId;
  readonly target: string;
  prepare(content: ContentPackage): AiPublisherRecord;
}

/** Mapping commun ; les importers spécialisés ne déclarent que leur cible. */
export abstract class BaseImporter implements AiContentImporter {
  public abstract readonly editor: EditorId;
  public abstract readonly target: string;

  public prepare(content: ContentPackage): AiPublisherRecord {
    return {
      packageId: content.id,
      editor: this.editor,
      target: this.target,
      slug: content.metadata.slug,
      category: content.metadata.category,
      language: content.metadata.language,
      title: content.metadata.title,
      markdown: content.articleMarkdown,
      metadata: structuredClone(content.metadata) as unknown as Readonly<Record<string, unknown>>,
      seo: structuredClone(content.seo) as unknown as Readonly<Record<string, unknown>>,
      images: content.images.map((image) =>
        structuredClone(image) as unknown as Readonly<Record<string, unknown>>),
    };
  }
}
