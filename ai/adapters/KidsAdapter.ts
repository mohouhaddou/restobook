import { BaseAdapter } from "./BaseAdapter";

/** Contrat d'intégration pour iFilino Kids. */
export class KidsAdapter extends BaseAdapter {
  public readonly id = "kids" as const;
  public readonly targetProduct = "Kids";
}
