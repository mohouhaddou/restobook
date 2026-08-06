import type { ContentPackage } from "../../../../ai/types";
import {
  ContentImporter,
  SeoResolver,
  SlugGenerator,
} from "../../../../ai/integration";
import {
  DEFAULT_AI_PUBLISHER_CONFIGURATION,
  type AiPublisherConfiguration,
} from "./AiPublisherConfiguration";

export interface AiPublisherValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/** Agrège toutes les validations avant ouverture d'une transaction. */
export class AiPublisherValidator {
  private readonly contentImporter = new ContentImporter();
  private readonly seoResolver = new SeoResolver();
  private readonly slugGenerator = new SlugGenerator();

  public constructor(
    private readonly configuration: AiPublisherConfiguration =
      DEFAULT_AI_PUBLISHER_CONFIGURATION,
  ) {}

  public validate(content: ContentPackage): AiPublisherValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const prepared = this.contentImporter.prepare(content);
    errors.push(...prepared.errors);
    warnings.push(...prepared.warnings);

    if (!content.articleMarkdown.trim()) errors.push("Le Markdown est obligatoire.");
    if (!content.metadata.title.trim()) errors.push("Le titre est obligatoire.");
    if (!content.metadata.category.trim()) errors.push("La catégorie est obligatoire.");
    if (!["fr", "ar", "en"].includes(content.metadata.language)) {
      errors.push("La langue doit être fr, ar ou en.");
    }
    const expectedSlug = this.slugGenerator.generate(
      content.metadata.slug,
      content.metadata.language,
    );
    if (!content.metadata.slug || content.metadata.slug !== expectedSlug) {
      errors.push("Le slug doit être présent et normalisé.");
    }
    if (this.configuration.requireImages && content.images.length === 0) {
      errors.push("Au moins une image est obligatoire.");
    }
    const seo = this.seoResolver.validate(content.seo);
    errors.push(...seo.errors);
    warnings.push(...seo.warnings);
    if (content.seo.title.length > this.configuration.maxSeoTitleLength) {
      warnings.push(`Le titre SEO dépasse ${this.configuration.maxSeoTitleLength} caractères.`);
    }
    if (content.seo.description.length > this.configuration.maxSeoDescriptionLength) {
      warnings.push(
        `La description SEO dépasse ${this.configuration.maxSeoDescriptionLength} caractères.`,
      );
    }
    if (!this.configuration.enabledEditors.includes(content.editor)) {
      errors.push(`La rédaction ${content.editor} est désactivée.`);
    }
    return {
      valid: errors.length === 0,
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)],
    };
  }
}
