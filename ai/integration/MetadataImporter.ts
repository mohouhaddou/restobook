import type { ContentPackage, Metadata, SeoMetadata } from "../types";
import { CategoryResolver, type ResolvedCategory } from "./CategoryResolver";
import { LanguageResolver } from "./LanguageResolver";
import { SeoResolver, type SeoValidationResult } from "./SeoResolver";
import { SlugGenerator } from "./SlugGenerator";
import { TagResolver } from "./TagResolver";

export interface MetadataImportResult {
  readonly metadata: Metadata;
  readonly seo: SeoMetadata;
  readonly category: ResolvedCategory;
  readonly seoValidation: SeoValidationResult;
  readonly errors: readonly string[];
  readonly valid: boolean;
}

/** Prépare et valide les métadonnées communes du package. */
export class MetadataImporter {
  public constructor(
    private readonly slugs = new SlugGenerator(),
    private readonly categories = new CategoryResolver(),
    private readonly tags = new TagResolver(),
    private readonly languages = new LanguageResolver(),
    private readonly seoResolver = new SeoResolver(),
  ) {}

  public prepare(content: ContentPackage): MetadataImportResult {
    const language = this.languages.resolve(content.metadata.language);
    const category = this.categories.resolve(content.editor, content.metadata.category);
    const metadata: Metadata = {
      ...structuredClone(content.metadata),
      title: content.metadata.title.trim(),
      slug: this.slugs.generate(
        content.metadata.slug || content.metadata.title,
        language,
      ),
      tags: this.tags.resolve(content.metadata.tags, language),
      keywords: this.tags.resolve(content.metadata.keywords, language),
      category: category.category,
      language,
    };
    const seo = this.seoResolver.resolve(content.seo);
    const seoValidation = this.seoResolver.validate(seo);
    const errors = [...seoValidation.errors];
    if (!metadata.title) errors.push("Le titre est obligatoire.");
    if (!metadata.slug) errors.push("Le slug est obligatoire.");
    if (!metadata.category) errors.push("La catégorie est obligatoire.");
    return {
      metadata,
      seo,
      category,
      seoValidation,
      errors,
      valid: errors.length === 0,
    };
  }
}
