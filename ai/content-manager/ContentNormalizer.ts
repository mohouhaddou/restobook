import type { ArticleSection } from "../types/ArticleSection";
import type { ContentPackage } from "../types/ContentPackage";
import type { ContentLanguage } from "../types/Metadata";

/** Options contrôlant les valeurs temporelles de la normalisation. */
export interface ContentNormalizerOptions {
  readonly now?: () => Date;
}

/** Uniformise un package sans modifier l'objet reçu. */
export class ContentNormalizer {
  private readonly now: () => Date;

  public constructor(options: ContentNormalizerOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  public normalize(content: ContentPackage): ContentPackage {
    const language = content.language.trim().toLowerCase() as ContentLanguage;
    const category = this.normalizeIdentifier(content.category);
    const articleMarkdown = this.normalizeMarkdown(content.articleMarkdown);
    const sections = this.orderSections(content.sections, articleMarkdown);

    return {
      ...structuredClone(content),
      category,
      language,
      updatedAt: this.now().toISOString(),
      articleMarkdown,
      sections,
      metadata: {
        ...content.metadata,
        title: content.metadata.title.trim(),
        slug: this.normalizeSlug(content.metadata.slug || content.metadata.title),
        excerpt: content.metadata.excerpt.trim(),
        description: content.metadata.description.trim(),
        keywords: this.normalizeTerms(content.metadata.keywords),
        tags: this.normalizeTerms(content.metadata.tags),
        author: structuredClone(content.metadata.author),
        category,
        language,
        sources: content.metadata.sources.map((source) => structuredClone(source)),
        license: structuredClone(content.metadata.license),
      },
      seo: {
        ...content.seo,
        title: content.seo.title.trim(),
        description: content.seo.description.trim(),
        canonical: content.seo.canonical.trim(),
        robots: content.seo.robots.trim(),
        openGraph: {
          ...content.seo.openGraph,
          title: content.seo.openGraph.title.trim(),
          description: content.seo.openGraph.description.trim(),
          image: content.seo.openGraph.image.trim(),
          type: content.seo.openGraph.type.trim(),
          siteName: content.seo.openGraph.siteName.trim(),
        },
        twitter: {
          ...content.seo.twitter,
          card: content.seo.twitter.card.trim(),
          title: content.seo.twitter.title.trim(),
          description: content.seo.twitter.description.trim(),
          image: content.seo.twitter.image.trim(),
        },
      },
    } as ContentPackage;
  }

  private normalizeMarkdown(markdown: string): string {
    const normalized = markdown.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim();
    return `${normalized.replace(/\n{3,}/g, "\n\n")}\n`;
  }

  private normalizeSlug(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private normalizeIdentifier(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, "-");
  }

  private normalizeTerms(values: readonly string[]): readonly string[] {
    return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
  }

  private orderSections(
    sections: readonly ArticleSection[],
    markdown: string,
  ): readonly ArticleSection[] {
    return sections
      .map((section, index) => ({
        section: structuredClone(section),
        index,
        position: markdown.indexOf(section.heading),
      }))
      .sort((left, right) => {
        const leftPosition = left.position < 0 ? Number.MAX_SAFE_INTEGER : left.position;
        const rightPosition = right.position < 0 ? Number.MAX_SAFE_INTEGER : right.position;
        return leftPosition - rightPosition || left.index - right.index;
      })
      .map(({ section }) => section);
  }
}
