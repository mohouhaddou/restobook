import type { ContentLanguage } from "../types";

const LANGUAGE_ALIASES: Readonly<Record<string, ContentLanguage>> = {
  fr: "fr",
  "fr-fr": "fr",
  french: "fr",
  français: "fr",
  ar: "ar",
  "ar-ma": "ar",
  arabic: "ar",
  arabe: "ar",
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  english: "en",
  anglais: "en",
};

/** Résout les variantes de langue vers le contrat `fr | ar | en`. */
export class LanguageResolver {
  public resolve(language: string): ContentLanguage {
    const resolved = LANGUAGE_ALIASES[language.trim().toLowerCase()];
    if (!resolved) throw new Error(`Langue non supportée : ${language}.`);
    return resolved;
  }
}
