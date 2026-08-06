import type { ContentLanguage } from "../types";

/** Génère des slugs Unicode propres pour le français, l'arabe et l'anglais. */
export class SlugGenerator {
  public generate(value: string, language: ContentLanguage): string {
    const normalized = language === "ar"
      ? value.normalize("NFKC")
      : value.normalize("NFD").replace(/\p{M}/gu, "");
    return normalized
      .toLocaleLowerCase(language)
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
  }
}
