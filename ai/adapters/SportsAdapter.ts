import { BaseAdapter } from "./BaseAdapter";

/** Contrat d'intégration pour iFilino Sports. */
export class SportsAdapter extends BaseAdapter {
  public readonly id = "sports" as const;
  public readonly targetProduct = "Sports";
}
