import type { ProviderHealth } from "../providers/ProviderHealth";
import type { ProviderRegistry } from "../providers/ProviderRegistry";

export interface BridgeHealthReport {
  readonly healthy: boolean; readonly timestamp: string;
  readonly queuePaused: boolean; readonly providers: Readonly<Record<string, boolean>>;
}
export class BridgeHealth {
  public constructor(private readonly registry: ProviderRegistry, private readonly providerHealth: ProviderHealth, private readonly queuePaused: () => boolean) {}
  public async check(): Promise<BridgeHealthReport> {
    const providers = await this.providerHealth.check(this.registry.list());
    return { healthy: Object.values(providers).some(Boolean), timestamp: new Date().toISOString(), queuePaused: this.queuePaused(), providers };
  }
}
