import type { ArticleSection } from "../types";
import { LinkResolver, type ResolvedLink } from "./LinkResolver";

export interface MarkdownImportResult {
  readonly markdown: string;
  readonly sections: readonly ArticleSection[];
  readonly links: readonly ResolvedLink[];
  readonly errors: readonly string[];
  readonly valid: boolean;
}

/** Normalise et analyse le Markdown sans le rendre ni le publier. */
export class MarkdownImporter {
  public constructor(private readonly links = new LinkResolver()) {}

  public prepare(markdown: string): MarkdownImportResult {
    const normalized = `${markdown
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+$/gm, "")
      .trim()
      .replace(/\n{3,}/g, "\n\n")}\n`;
    const sections = this.extractSections(normalized);
    const resolvedLinks = this.extractLinks(normalized).map((link) => this.links.resolve(link));
    const errors: string[] = [];
    if (!normalized.trim()) errors.push("Le Markdown est vide.");
    for (const link of resolvedLinks.filter((candidate) => !candidate.valid)) {
      errors.push(`Lien invalide : ${link.original}.`);
    }
    return {
      markdown: normalized,
      sections,
      links: resolvedLinks,
      errors,
      valid: errors.length === 0,
    };
  }

  private extractSections(markdown: string): readonly ArticleSection[] {
    const lines = markdown.split("\n");
    const sections: ArticleSection[] = [];
    let current: { heading: string; level: ArticleSection["level"]; body: string[] } | undefined;
    const flush = (): void => {
      if (!current) return;
      sections.push({
        heading: current.heading,
        level: current.level,
        content: current.body.join("\n").trim(),
      });
    };
    for (const line of lines) {
      const heading = /^(#{2,6})\s+(.+)$/.exec(line);
      if (heading) {
        flush();
        current = {
          heading: heading[2].trim(),
          level: heading[1].length as ArticleSection["level"],
          body: [],
        };
      } else if (current) {
        current.body.push(line);
      }
    }
    flush();
    return sections;
  }

  private extractLinks(markdown: string): readonly string[] {
    const links: string[] = [];
    for (const match of markdown.matchAll(/(?<!!)\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      links.push(match[1]);
    }
    for (const match of markdown.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)) {
      links.push(match[1]);
    }
    return links;
  }
}
