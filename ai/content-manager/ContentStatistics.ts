import type { ContentPackage } from "../types/ContentPackage";

/** Mesures techniques calculées à partir d'un package. */
export interface ContentStatisticsReport {
  readonly wordCount: number;
  readonly imageCount: number;
  readonly readingTime: number;
  readonly sectionCount: number;
  readonly linkCount: number;
  readonly packageSize: number;
}

/** Calcule des statistiques déterministes, sans persistance. */
export class ContentStatistics {
  public calculate(content: ContentPackage): ContentStatisticsReport {
    const plainText = content.articleMarkdown
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#>*_`~-]/g, " ");
    const words = plainText.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu) ?? [];
    const markdownLinks = content.articleMarkdown.match(/(?<!!)\[[^\]]+\]\([^)]+\)/g) ?? [];
    const htmlLinks = content.articleMarkdown.match(/<a\s[^>]*href=/gi) ?? [];

    return {
      wordCount: words.length,
      imageCount: content.images.length,
      readingTime: words.length === 0 ? 0 : Math.ceil(words.length / 200),
      sectionCount: content.sections.length,
      linkCount: markdownLinks.length + htmlLinks.length,
      packageSize: new TextEncoder().encode(JSON.stringify(content)).byteLength,
    };
  }
}
