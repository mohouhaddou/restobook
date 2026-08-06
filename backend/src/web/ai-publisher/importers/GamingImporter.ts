import { BaseImporter } from "./BaseImporter";

export class GamingImporter extends BaseImporter {
  public readonly editor = "gaming" as const;
  public readonly target = "gaming_articles";
}
