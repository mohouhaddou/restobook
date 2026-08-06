import { BaseImporter } from "./BaseImporter";

export class SportsImporter extends BaseImporter {
  public readonly editor = "sports" as const;
  public readonly target = "sports_articles";
}
