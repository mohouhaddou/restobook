import path from "node:path";
import type { EditorId, ImageAsset } from "../types";

const ASSET_DIRECTORIES: Readonly<Record<EditorId, string>> = {
  discover: "uploads/discover",
  sports: "uploads/sports",
  kids: "uploads/kids",
  stories: "uploads/stories",
  gaming: "uploads/gaming",
  nature: "uploads/kids/nature",
  animals: "uploads/kids/animals",
  space: "uploads/kids/space",
  science: "uploads/kids/science",
  study: "uploads/kids/study",
};

/** Asset préparé : il décrit une destination future, sans copie. */
export interface ResolvedAsset {
  readonly imageId: string;
  readonly sourcePath: string;
  readonly targetPath: string;
}

export class AssetResolver {
  public baseDirectory(editor: EditorId): string {
    return ASSET_DIRECTORIES[editor];
  }

  public resolve(editor: EditorId, image: ImageAsset): ResolvedAsset {
    return {
      imageId: image.id,
      sourcePath: image.relativePath,
      targetPath: path.posix.join(this.baseDirectory(editor), path.posix.basename(image.filename)),
    };
  }
}
