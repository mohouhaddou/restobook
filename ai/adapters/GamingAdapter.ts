import { BaseAdapter } from "./BaseAdapter";

/** Contrat d'intégration pour iFilino GamingHub. */
export class GamingAdapter extends BaseAdapter {
  public readonly id = "gaming" as const;
  public readonly targetProduct = "GamingHub";
}
