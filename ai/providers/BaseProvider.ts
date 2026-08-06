import type { AIProvider, AIRequest, AIResponse } from "./AIProvider";
import type { ProviderCapabilities } from "./ProviderCapabilities";

/** Port fournisseur stable consommé uniquement par le Bridge. */
export abstract class BaseProvider implements AIProvider {
  public abstract readonly id: string;
  public abstract readonly capabilities: ProviderCapabilities;
  public abstract generate(request: AIRequest): Promise<AIResponse>;
  public abstract health(): Promise<boolean>;
}
