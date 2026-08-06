import type { Job } from "../jobs/Job";
import type { AIProvider } from "./AIProvider";
import type { ProviderRegistry } from "./ProviderRegistry";

export type ProviderSelectionStrategy = (job: Readonly<Job>, providers: readonly AIProvider[]) => AIProvider | undefined;

/** Sélection configurable; le Dashboard ne voit que l'identifiant retenu. */
export class ProviderSelector {
  public constructor(
    private readonly registry: ProviderRegistry,
    private readonly defaultProvider = "mock",
    private readonly strategy?: ProviderSelectionStrategy,
  ) {}
  public async select(job: Readonly<Job>): Promise<AIProvider> {
    if (job.provider) return this.registry.get(job.provider);
    const healthy: AIProvider[] = [];
    for (const provider of this.registry.list()) if (await provider.health()) healthy.push(provider);
    const selected = this.strategy?.(job, healthy) ?? healthy.find(provider => provider.id === this.defaultProvider) ?? healthy[0];
    if (!selected) throw new Error("PROVIDER_UNAVAILABLE");
    return selected;
  }
}
