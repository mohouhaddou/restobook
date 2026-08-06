import type { ContentPackage } from '../types';

/** Rapport de validation structurelle d’un `ContentPackage`. */
export interface PublisherValidationResult {
  /** Indique si le paquet peut entrer dans le pipeline. */
  readonly valid: boolean;
  /** Erreurs bloquantes détectées. */
  readonly errors: readonly string[];
  /** Avertissements non bloquants détectés. */
  readonly warnings: readonly string[];
}

/**
 * Validateur structurel du Publisher.
 *
 * Il ne contient aucune règle propre à un produit iFilino.
 */
export class PublisherValidator {
  /** Vérifie le paquet, les images, le Markdown, les métadonnées et le SEO. */
  validate(candidate: unknown): PublisherValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.isRecord(candidate)) {
      return { valid: false, errors: ['ContentPackage doit être un objet.'], warnings };
    }

    for (const property of [
      'id', 'editor', 'category', 'language', 'createdAt', 'updatedAt',
      'articleMarkdown', 'metadata', 'images', 'seo', 'workflow', 'version', 'status',
    ]) {
      if (!(property in candidate)) errors.push(`ContentPackage.${property} est obligatoire.`);
    }

    this.requireString(candidate.id, 'ContentPackage.id', errors);
    this.requireString(candidate.editor, 'ContentPackage.editor', errors);
    this.requireString(candidate.category, 'ContentPackage.category', errors);
    this.requireString(candidate.language, 'ContentPackage.language', errors);
    this.requireString(candidate.createdAt, 'ContentPackage.createdAt', errors);
    this.requireString(candidate.updatedAt, 'ContentPackage.updatedAt', errors);
    this.requireString(candidate.version, 'ContentPackage.version', errors);
    this.requireString(candidate.status, 'ContentPackage.status', errors);

    if (typeof candidate.articleMarkdown !== 'string' || !candidate.articleMarkdown.trim()) {
      errors.push('ContentPackage.articleMarkdown doit contenir du Markdown.');
    }

    this.validateImages(candidate.images, errors);
    this.validateMetadata(candidate.metadata, errors);
    this.validateSeo(candidate.seo, errors);

    if (!this.isRecord(candidate.workflow)) {
      errors.push('ContentPackage.workflow doit être un objet.');
    }
    if (!Array.isArray(candidate.sections)) {
      errors.push('ContentPackage.sections doit être un tableau.');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /** Garde de type utilisable après une validation réussie. */
  isContentPackage(candidate: unknown): candidate is ContentPackage {
    return this.validate(candidate).valid;
  }

  private validateImages(value: unknown, errors: string[]): void {
    if (!Array.isArray(value) || value.length === 0) {
      errors.push('ContentPackage.images doit contenir au moins une image.');
      return;
    }

    value.forEach((image, index) => {
      if (!this.isRecord(image)) {
        errors.push(`ContentPackage.images[${index}] doit être un objet.`);
        return;
      }
      for (const property of [
        'id', 'filename', 'alt', 'caption', 'role', 'width', 'height',
        'format', 'relativePath', 'generated',
      ]) {
        if (!(property in image)) errors.push(`ContentPackage.images[${index}].${property} est obligatoire.`);
      }
      this.requireString(image.id, `ContentPackage.images[${index}].id`, errors);
      this.requireString(image.filename, `ContentPackage.images[${index}].filename`, errors);
      this.requireString(image.alt, `ContentPackage.images[${index}].alt`, errors);
      this.requireString(image.role, `ContentPackage.images[${index}].role`, errors);
      this.requireString(image.format, `ContentPackage.images[${index}].format`, errors);
      this.requireString(image.relativePath, `ContentPackage.images[${index}].relativePath`, errors);
      if (!Number.isInteger(image.width) || Number(image.width) < 1) {
        errors.push(`ContentPackage.images[${index}].width doit être un entier positif.`);
      }
      if (!Number.isInteger(image.height) || Number(image.height) < 1) {
        errors.push(`ContentPackage.images[${index}].height doit être un entier positif.`);
      }
      if (typeof image.generated !== 'boolean') {
        errors.push(`ContentPackage.images[${index}].generated doit être un booléen.`);
      }
    });
  }

  private validateMetadata(value: unknown, errors: string[]): void {
    if (!this.isRecord(value)) {
      errors.push('ContentPackage.metadata doit être un objet.');
      return;
    }
    for (const property of [
      'title', 'slug', 'excerpt', 'description', 'author', 'category',
      'language', 'readingTime', 'difficulty', 'sources', 'license',
    ]) {
      if (!(property in value)) errors.push(`ContentPackage.metadata.${property} est obligatoire.`);
    }
    for (const property of ['title', 'slug', 'excerpt', 'description', 'category', 'language', 'difficulty']) {
      this.requireString(value[property], `ContentPackage.metadata.${property}`, errors);
    }
    if (!Array.isArray(value.keywords)) errors.push('ContentPackage.metadata.keywords doit être un tableau.');
    if (!Array.isArray(value.tags)) errors.push('ContentPackage.metadata.tags doit être un tableau.');
    if (!Array.isArray(value.sources)) errors.push('ContentPackage.metadata.sources doit être un tableau.');
    if (!Number.isInteger(value.readingTime) || Number(value.readingTime) < 1) {
      errors.push('ContentPackage.metadata.readingTime doit être un entier positif.');
    }
    if (!this.isRecord(value.author)) errors.push('ContentPackage.metadata.author doit être un objet.');
    if (!this.isRecord(value.license)) errors.push('ContentPackage.metadata.license doit être un objet.');
  }

  private validateSeo(value: unknown, errors: string[]): void {
    if (!this.isRecord(value)) {
      errors.push('ContentPackage.seo doit être un objet.');
      return;
    }
    for (const property of ['title', 'description', 'canonical', 'robots']) {
      this.requireString(value[property], `ContentPackage.seo.${property}`, errors);
    }
    if (!this.isRecord(value.openGraph)) {
      errors.push('ContentPackage.seo.openGraph doit être un objet.');
    }
    if (!this.isRecord(value.twitter)) {
      errors.push('ContentPackage.seo.twitter doit être un objet.');
    }
  }

  private requireString(value: unknown, property: string, errors: string[]): void {
    if (typeof value !== 'string' || !value.trim()) errors.push(`${property} doit être une chaîne non vide.`);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
