import { access, realpath, stat } from "node:fs/promises";
import path from "node:path";

/** Rapport de validation d'un package matérialisé sur disque. */
export interface FileValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/** Vérifie la convention `article.md`, `metadata.json`, `images/cover.webp`. */
export class FileValidator {
  public async validate(packageDirectory: string): Promise<FileValidationResult> {
    const errors: string[] = [];
    const required = [
      ["article.md", "file"],
      ["metadata.json", "file"],
      ["images", "directory"],
      [path.join("images", "cover.webp"), "file"],
    ] as const;

    for (const [relativePath, expectedType] of required) {
      const target = path.resolve(packageDirectory, relativePath);
      const relative = path.relative(path.resolve(packageDirectory), target);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        errors.push(`Chemin incohérent : ${relativePath}.`);
        continue;
      }
      try {
        await access(target);
        const information = await stat(target);
        if (expectedType === "file" && !information.isFile()) {
          errors.push(`${relativePath} doit être un fichier.`);
        }
        if (expectedType === "directory" && !information.isDirectory()) {
          errors.push(`${relativePath} doit être un dossier.`);
        }
        const canonical = await realpath(target);
        const root = await realpath(packageDirectory);
        const canonicalRelative = path.relative(root, canonical);
        if (canonicalRelative.startsWith("..") || path.isAbsolute(canonicalRelative)) {
          errors.push(`Chemin hors package : ${relativePath}.`);
        }
      } catch {
        errors.push(`${relativePath} est absent.`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
}
