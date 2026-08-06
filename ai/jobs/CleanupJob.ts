import type { OrchestratorContext, OrchestratorModulePort } from "../orchestrator/OrchestratorContext";
import type { OrchestratorJob } from "./PublishJob";
import type { JobResult } from "./JobResult";

/** Job optionnel de nettoyage, sans implémentation de suppression propre. */
export class CleanupJob implements OrchestratorJob {
  public readonly type = "cleanup";
  public readonly state = "ARCHIVING" as const;
  public constructor(private readonly port: OrchestratorModulePort) {}
  public execute(context: OrchestratorContext): Promise<JobResult> {
    return this.port.execute(context);
  }
}
