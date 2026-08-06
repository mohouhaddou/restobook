import type { ContentPackage } from "../types/ContentPackage";
import type { ContentVersion } from "./ContentVersionManager";
import { ContentVersionManager } from "./ContentVersionManager";

/** Vue en lecture seule de l'historique des versions. */
export class ContentHistory {
  public constructor(private readonly versions: ContentVersionManager) {}

  public list(contentId: string): readonly ContentVersion[] {
    return this.versions.list(contentId);
  }

  public get(contentId: string, version: string): ContentPackage {
    return this.versions.get(contentId, version).package;
  }

  public latest(contentId: string): ContentVersion {
    return this.versions.latest(contentId);
  }
}
