import type { OrchestratorDependencies } from "./OrchestratorContext";

export type HealthComponent =
  | "Workflow Engine"
  | "Publisher Engine"
  | "Content Manager"
  | "FileSystem"
  | "Integration Layer"
  | "AI Publisher"
  | "Orchestrator";

export interface HealthCheckReport {
  readonly healthy: boolean;
  readonly checkedAt: string;
  readonly components: Readonly<Record<HealthComponent, boolean>>;
}

/** Agrège les probes injectées sans connaître les implémentations. */
export class HealthCheck {
  public constructor(
    private readonly dependencies: OrchestratorDependencies,
    private readonly orchestratorProbe: () => boolean,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async check(): Promise<HealthCheckReport> {
    const components: Record<HealthComponent, boolean> = {
      "Workflow Engine": await this.safe(this.dependencies.workflowEngine),
      "Publisher Engine": await this.safe(this.dependencies.publisherEngine),
      "Content Manager": await this.safe(this.dependencies.contentManager),
      FileSystem: await this.safe(this.dependencies.fileSystem),
      "Integration Layer": await this.safe(this.dependencies.integrationLayer),
      "AI Publisher": await this.safe(this.dependencies.aiPublisher),
      Orchestrator: this.orchestratorProbe(),
    };
    return {
      healthy: Object.values(components).every(Boolean),
      checkedAt: this.now().toISOString(),
      components,
    };
  }

  private async safe(port: { health(): Promise<boolean> }): Promise<boolean> {
    try {
      return await port.health();
    } catch {
      return false;
    }
  }
}
