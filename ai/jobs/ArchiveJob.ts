import type { OrchestratorContext, OrchestratorModulePort } from "../orchestrator/OrchestratorContext";
import type { OrchestratorJob } from "./PublishJob";
import type { JobResult } from "./JobResult";

export class ArchiveJob implements OrchestratorJob {
  public readonly type = "archive";
  public readonly state = "ARCHIVING" as const;
  public constructor(private readonly port: OrchestratorModulePort) {}
  public execute(context: OrchestratorContext): Promise<JobResult> {
    return this.port.execute(context);
  }
}
