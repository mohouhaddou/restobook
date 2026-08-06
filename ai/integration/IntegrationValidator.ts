import type { ContentPackage, EditorId } from "../types";
import { ContentImporter } from "./ContentImporter";

export interface IntegrationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/** Vérifie qu'un package peut être préparé pour l'adapter demandé. */
export class IntegrationValidator {
  public constructor(private readonly importer = new ContentImporter()) {}

  public validate(
    content: ContentPackage,
    adapterId: EditorId,
  ): IntegrationValidationResult {
    const prepared = this.importer.prepare(content);
    const errors = [...prepared.errors];
    if (content.editor !== adapterId) {
      errors.push(`L'éditeur ${content.editor} ne correspond pas à l'adapter ${adapterId}.`);
    }
    return { valid: errors.length === 0, errors, warnings: prepared.warnings };
  }
}
