import type { ContentPackage, ImageAsset } from "../types";
import { AssetResolver, type ResolvedAsset } from "./AssetResolver";

export interface ImageImportResult {
  readonly assets: readonly ResolvedAsset[];
  readonly missingImageReferences: readonly string[];
  readonly errors: readonly string[];
  readonly valid: boolean;
}

/** Valide les descriptions d'images et prépare leurs futures destinations. */
export class ImageImporter {
  public constructor(private readonly assets = new AssetResolver()) {}

  public prepare(content: ContentPackage): ImageImportResult {
    const ids = new Set(content.images.map((image) => image.id));
    const missing = [
      ...new Set(
        content.sections
          .map((section) => section.imageReference)
          .filter((reference): reference is string => typeof reference === "string" && !ids.has(reference)),
      ),
    ];
    const errors = content.images.flatMap((image) => this.validateImage(image));
    if (missing.length) errors.push(`Images référencées absentes : ${missing.join(", ")}.`);
    return {
      assets: content.images.map((image) => this.assets.resolve(content.editor, image)),
      missingImageReferences: missing,
      errors,
      valid: errors.length === 0,
    };
  }

  private validateImage(image: ImageAsset): readonly string[] {
    const errors: string[] = [];
    if (!image.id.trim()) errors.push("Une image doit avoir un identifiant.");
    if (!image.filename.trim()) errors.push(`L'image ${image.id} doit avoir un nom.`);
    if (!image.relativePath.trim()) errors.push(`L'image ${image.id} doit avoir un chemin.`);
    if (image.width <= 0 || image.height <= 0) {
      errors.push(`L'image ${image.id} doit avoir des dimensions positives.`);
    }
    return errors;
  }
}
