/** Nettoie, normalise et déduplique les tags sans muter la source. */
export class TagResolver {
  public resolve(tags: readonly string[], locale = "fr"): readonly string[] {
    const unique = new Map<string, string>();
    for (const tag of tags) {
      const normalized = tag.normalize("NFKC").trim().replace(/\s+/g, " ");
      if (normalized) unique.set(normalized.toLocaleLowerCase(locale), normalized.toLocaleLowerCase(locale));
    }
    return [...unique.values()].sort((left, right) => left.localeCompare(right, locale));
  }
}
