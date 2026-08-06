import { BaseAdapter } from "./BaseAdapter";

/** Contrat d'intégration pour iFilino Discover. */
export class DiscoverAdapter extends BaseAdapter {
  public readonly id = "discover" as const;
  public readonly targetProduct = "Discover";
}
