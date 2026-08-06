import type { ArticleSection } from "../types/ArticleSection";
import type { ContentPackage } from "../types/ContentPackage";
import type { ImageAsset } from "../types/ImageAsset";

/** Modification détectée entre deux sections de versions distinctes. */
export interface SectionModification {
  readonly index: number;
  readonly before?: ArticleSection;
  readonly after?: ArticleSection;
}

/** Synthèse des différences structurelles entre deux packages. */
export interface ContentComparison {
  readonly modifiedSections: readonly SectionModification[];
  readonly seoModified: boolean;
  readonly imagesAdded: readonly ImageAsset[];
  readonly imagesRemoved: readonly ImageAsset[];
  readonly metadataModified: boolean;
}

/** Compare deux instantanés sans interpréter leur contenu métier. */
export class ContentComparer {
  public compare(before: ContentPackage, after: ContentPackage): ContentComparison {
    const sectionCount = Math.max(before.sections.length, after.sections.length);
    const modifiedSections: SectionModification[] = [];
    for (let index = 0; index < sectionCount; index += 1) {
      if (!this.equal(before.sections[index], after.sections[index])) {
        modifiedSections.push({
          index,
          before: before.sections[index] && structuredClone(before.sections[index]),
          after: after.sections[index] && structuredClone(after.sections[index]),
        });
      }
    }

    const beforeImages = new Map(before.images.map((image) => [image.id, image]));
    const afterImages = new Map(after.images.map((image) => [image.id, image]));

    return {
      modifiedSections,
      seoModified: !this.equal(before.seo, after.seo),
      imagesAdded: after.images
        .filter((image) => !beforeImages.has(image.id))
        .map((image) => structuredClone(image)),
      imagesRemoved: before.images
        .filter((image) => !afterImages.has(image.id))
        .map((image) => structuredClone(image)),
      metadataModified: !this.equal(before.metadata, after.metadata),
    };
  }

  private equal(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}
