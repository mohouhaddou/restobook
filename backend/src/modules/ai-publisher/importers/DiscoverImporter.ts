import { BaseImporter } from "./BaseImporter";

export class DiscoverImporter extends BaseImporter {
  public readonly editor = "discover" as const;
  public readonly target = "discover_articles";
}
