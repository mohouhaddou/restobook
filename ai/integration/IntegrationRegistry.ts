import type { EditorId } from "../types";
import type { IntegrationAdapter } from "../adapters/BaseAdapter";
import {
  AdapterAlreadyRegisteredError,
  AdapterNotFoundError,
} from "./IntegrationErrors";

/** Registre générique d'adapters, indépendant de leur implémentation. */
export class IntegrationRegistry {
  private readonly adapters = new Map<EditorId, IntegrationAdapter>();

  public register(adapter: IntegrationAdapter): void {
    if (this.adapters.has(adapter.id)) throw new AdapterAlreadyRegisteredError(adapter.id);
    this.adapters.set(adapter.id, adapter);
  }

  public unregister(adapterId: EditorId): boolean {
    return this.adapters.delete(adapterId);
  }

  public get(adapterId: EditorId): IntegrationAdapter {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) throw new AdapterNotFoundError(adapterId);
    return adapter;
  }

  public list(): readonly IntegrationAdapter[] {
    return [...this.adapters.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  public has(adapterId: EditorId): boolean {
    return this.adapters.has(adapterId);
  }
}
