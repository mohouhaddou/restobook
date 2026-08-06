import type { OrchestratorDependencies } from "./OrchestratorContext";
import { JobFactory, type StandardJobType } from "../jobs/JobFactory";
import type { OrchestratorJob } from "../jobs/PublishJob";

export interface OrchestratorPipelineStep {
  readonly id: string;
  readonly type: StandardJobType;
  readonly module: keyof Omit<OrchestratorDependencies, "hooks">;
  readonly enabled: boolean;
}

/** Définition configurable d'un workflow orchestré. */
export class OrchestratorPipeline {
  public constructor(
    public readonly id: string,
    public readonly steps: readonly OrchestratorPipelineStep[],
  ) {
    if (!id.trim()) throw new Error("Un pipeline doit avoir un identifiant.");
    if (!steps.some((step) => step.enabled)) throw new Error("Un pipeline doit avoir une étape active.");
  }

  public jobs(
    dependencies: OrchestratorDependencies,
    factory = new JobFactory(),
  ): readonly OrchestratorJob[] {
    return this.steps
      .filter((step) => step.enabled)
      .map((step) => {
        const port = dependencies[step.module];
        if (!port || typeof port !== "object" || !("execute" in port)) {
          throw new Error(`Module indisponible : ${String(step.module)}.`);
        }
        return factory.create(step.type, port);
      });
  }

  public static default(archiveOnSuccess = true): OrchestratorPipeline {
    return new OrchestratorPipeline("default", [
      { id: "filesystem", type: "validation", module: "fileSystem", enabled: true },
      { id: "content", type: "validation", module: "contentManager", enabled: true },
      { id: "workflow", type: "validation", module: "workflowEngine", enabled: true },
      { id: "publisher", type: "publish", module: "publisherEngine", enabled: true },
      { id: "integration", type: "import", module: "integrationLayer", enabled: true },
      { id: "backend", type: "publish", module: "aiPublisher", enabled: true },
      { id: "archive", type: "archive", module: "archive", enabled: archiveOnSuccess },
    ]);
  }
}
