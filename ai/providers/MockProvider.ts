import type { AIRequest, AIResponse } from "./AIProvider";
import { BaseProvider } from "./BaseProvider";
import { DEFAULT_PROVIDER_CAPABILITIES } from "./ProviderCapabilities";

/** Fournisseur déterministe permettant d'exécuter tout le pipeline hors ligne. */
export class MockProvider extends BaseProvider {
  public readonly id = "mock";
  public readonly capabilities = DEFAULT_PROVIDER_CAPABILITIES;
  public async generate(request: AIRequest): Promise<AIResponse> {
    return {
      provider: this.id,
      model: request.model,
      content: `# ${request.prompt}\n\nContenu de démonstration généré par le fournisseur Mock.`,
      latencyMs: 0,
    };
  }
  public async health(): Promise<boolean> { return true; }
}
