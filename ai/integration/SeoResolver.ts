import type { SeoMetadata } from "../types";

export interface SeoValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/** Valide et normalise les métadonnées SEO sans générer de contenu. */
export class SeoResolver {
  public resolve(seo: SeoMetadata): SeoMetadata {
    return {
      ...structuredClone(seo),
      title: seo.title.trim(),
      description: seo.description.trim(),
      canonical: seo.canonical.trim(),
      openGraph: {
        ...seo.openGraph,
        title: seo.openGraph.title.trim(),
        description: seo.openGraph.description.trim(),
        image: seo.openGraph.image.trim(),
        siteName: seo.openGraph.siteName.trim(),
      },
      twitter: {
        ...seo.twitter,
        title: seo.twitter.title.trim(),
        description: seo.twitter.description.trim(),
        image: seo.twitter.image.trim(),
      },
    };
  }

  public validate(seo: SeoMetadata): SeoValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!seo.title) errors.push("Le titre SEO est obligatoire.");
    if (seo.title.length > 60) warnings.push("Le titre SEO dépasse 60 caractères.");
    if (!seo.description) errors.push("La description SEO est obligatoire.");
    if (seo.description.length > 160) warnings.push("La description SEO dépasse 160 caractères.");
    try {
      const canonical = new URL(seo.canonical);
      if (!["http:", "https:"].includes(canonical.protocol)) {
        errors.push("Le canonical doit utiliser HTTP ou HTTPS.");
      }
    } catch {
      errors.push("Le canonical doit être une URL absolue valide.");
    }
    if (!seo.openGraph.title || !seo.openGraph.description || !seo.openGraph.image) {
      errors.push("OpenGraph doit contenir titre, description et image.");
    }
    if (!seo.twitter.title || !seo.twitter.description || !seo.twitter.image) {
      errors.push("Twitter Card doit contenir titre, description et image.");
    }
    return { valid: errors.length === 0, errors, warnings };
  }
}
