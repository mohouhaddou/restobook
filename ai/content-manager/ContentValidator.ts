import type { ContentPackage } from "../types/ContentPackage";

/** Résultat détaillé d'une validation structurelle. */
export interface ContentValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/** Vérifie le contrat minimal attendu par le gestionnaire de contenus. */
export class ContentValidator {
  public validate(content: ContentPackage): ContentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content.id.trim()) errors.push("id est obligatoire.");
    if (!content.editor) errors.push("editor est obligatoire.");
    if (!content.category.trim()) errors.push("category est obligatoire.");
    if (!content.language.trim()) errors.push("language est obligatoire.");
    if (!content.articleMarkdown.trim()) errors.push("articleMarkdown est obligatoire.");
    if (!content.metadata.title.trim()) errors.push("metadata.title est obligatoire.");
    if (!content.metadata.slug.trim()) errors.push("metadata.slug est obligatoire.");
    if (!content.metadata.description.trim()) errors.push("metadata.description est obligatoire.");
    if (!content.seo.title.trim()) errors.push("seo.title est obligatoire.");
    if (!content.seo.description.trim()) errors.push("seo.description est obligatoire.");
    if (!content.workflow.editor) errors.push("workflow.editor est obligatoire.");
    if (!content.workflow.steps.length) errors.push("workflow.steps doit contenir au moins une étape.");
    if (!content.version.trim()) errors.push("version est obligatoire.");
    if (Number.isNaN(Date.parse(content.createdAt))) errors.push("createdAt doit être une date ISO valide.");
    if (Number.isNaN(Date.parse(content.updatedAt))) errors.push("updatedAt doit être une date ISO valide.");

    const imageIds = new Set<string>();
    for (const image of content.images) {
      if (!image.id.trim()) errors.push("Chaque image doit avoir un id.");
      if (imageIds.has(image.id)) errors.push(`Identifiant d'image dupliqué : ${image.id}.`);
      imageIds.add(image.id);
      if (!image.filename.trim()) errors.push(`L'image ${image.id || "(sans id)"} doit avoir un filename.`);
      if (image.width <= 0 || image.height <= 0) {
        errors.push(`Les dimensions de l'image ${image.id || "(sans id)"} doivent être positives.`);
      }
    }

    for (const section of content.sections) {
      if (!section.heading.trim()) errors.push("Chaque section doit avoir un heading.");
      if (!section.content.trim()) warnings.push(`La section "${section.heading}" est vide.`);
      if (section.imageReference && !imageIds.has(section.imageReference)) {
        errors.push(`Référence d'image inconnue : ${section.imageReference}.`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
