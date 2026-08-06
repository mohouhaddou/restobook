import type { ArticleSection, ContentPackage } from "../types";
import { ImageImporter, type ImageImportResult } from "./ImageImporter";
import { MarkdownImporter, type MarkdownImportResult } from "./MarkdownImporter";
import { MetadataImporter, type MetadataImportResult } from "./MetadataImporter";

export interface ContentImportResult {
  readonly package: ContentPackage;
  readonly markdown: MarkdownImportResult;
  readonly images: ImageImportResult;
  readonly metadata: MetadataImportResult;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly valid: boolean;
}

/** Coordonne la préparation pure d'un ContentPackage, sans le publier. */
export class ContentImporter {
  public constructor(
    private readonly markdownImporter = new MarkdownImporter(),
    private readonly imageImporter = new ImageImporter(),
    private readonly metadataImporter = new MetadataImporter(),
  ) {}

  public prepare(content: ContentPackage): ContentImportResult {
    const markdown = this.markdownImporter.prepare(content.articleMarkdown);
    const metadata = this.metadataImporter.prepare(content);
    const sections = this.mergeSectionReferences(markdown.sections, content.sections);
    const prepared: ContentPackage = {
      ...structuredClone(content),
      category: metadata.category.category,
      language: metadata.metadata.language,
      articleMarkdown: markdown.markdown,
      sections,
      metadata: metadata.metadata,
      seo: metadata.seo,
    };
    const images = this.imageImporter.prepare(prepared);
    const errors = [...markdown.errors, ...images.errors, ...metadata.errors];
    return {
      package: prepared,
      markdown,
      images,
      metadata,
      errors,
      warnings: [...metadata.seoValidation.warnings],
      valid: errors.length === 0,
    };
  }

  private mergeSectionReferences(
    extracted: readonly ArticleSection[],
    original: readonly ArticleSection[],
  ): readonly ArticleSection[] {
    const references = new Map(
      original
        .filter((section) => section.imageReference)
        .map((section) => [section.heading, section.imageReference]),
    );
    return extracted.map((section) => ({
      ...section,
      imageReference: references.get(section.heading),
    }));
  }
}
