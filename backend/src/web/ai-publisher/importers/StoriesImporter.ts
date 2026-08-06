import { BaseImporter } from "./BaseImporter";

export class StoriesImporter extends BaseImporter {
  public readonly editor = "stories" as const;
  public readonly target = "stories_articles";
}
