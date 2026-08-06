import type { OrchestratorContext, OrchestratorModulePort } from "../orchestrator/OrchestratorContext";
import type { JobResult } from "./JobResult";

export interface OrchestratorJob {
  readonly type: string;
  readonly state: OrchestratorContext["state"];
  execute(context: OrchestratorContext): Promise<JobResult>;
}

/** Job générique déléguant la publication au port injecté. */
export class PublishJob implements OrchestratorJob {
  public readonly type = "publish";
  public readonly state = "PUBLISHING" as const;
  public constructor(private readonly port: OrchestratorModulePort) {}
  public execute(context: OrchestratorContext): Promise<JobResult> {
    return this.port.execute(context);
  }
}
