import { BaseImporter } from "./BaseImporter";

export class KidsImporter extends BaseImporter {
  public readonly editor = "kids" as const;
  public readonly target = "kids_articles";
}
