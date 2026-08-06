import { BaseAdapter } from "./BaseAdapter";

/** Contrat d'intégration pour iFilino Stories. */
export class StoriesAdapter extends BaseAdapter {
  public readonly id = "stories" as const;
  public readonly targetProduct = "Stories";
}
