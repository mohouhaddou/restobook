import type { OrchestratorContext, OrchestratorModulePort } from "../orchestrator/OrchestratorContext";
import type { OrchestratorJob } from "./PublishJob";
import type { JobResult } from "./JobResult";

export class ValidationJob implements OrchestratorJob {
  public readonly type = "validation";
  public readonly state = "VALIDATING" as const;
  public constructor(private readonly port: OrchestratorModulePort) {}
  public execute(context: OrchestratorContext): Promise<JobResult> {
    return this.port.execute(context);
  }
}
