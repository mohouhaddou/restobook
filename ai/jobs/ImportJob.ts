import type { OrchestratorContext, OrchestratorModulePort } from "../orchestrator/OrchestratorContext";
import type { OrchestratorJob } from "./PublishJob";
import type { JobResult } from "./JobResult";

export class ImportJob implements OrchestratorJob {
  public readonly type = "import";
  public readonly state = "IMPORTING" as const;
  public constructor(private readonly port: OrchestratorModulePort) {}
  public execute(context: OrchestratorContext): Promise<JobResult> {
    return this.port.execute(context);
  }
}
