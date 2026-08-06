import type {
  OrchestratorContext,
  OrchestratorModulePort,
} from "../orchestrator/OrchestratorContext";
import { ArchiveJob } from "./ArchiveJob";
import { CleanupJob } from "./CleanupJob";
import { ImportJob } from "./ImportJob";
import { PublishJob, type OrchestratorJob } from "./PublishJob";
import { ValidationJob } from "./ValidationJob";

export type StandardJobType = "validation" | "import" | "publish" | "archive" | "cleanup";

/** Fabrique extensible de jobs standard. */
export class JobFactory {
  public create(type: StandardJobType, port: OrchestratorModulePort): OrchestratorJob {
    const factories: Record<StandardJobType, () => OrchestratorJob> = {
      validation: () => new ValidationJob(port),
      import: () => new ImportJob(port),
      publish: () => new PublishJob(port),
      archive: () => new ArchiveJob(port),
      cleanup: () => new CleanupJob(port),
    };
    return factories[type]();
  }

  public static stateFor(type: StandardJobType): OrchestratorContext["state"] {
    return {
      validation: "VALIDATING",
      import: "IMPORTING",
      publish: "PUBLISHING",
      archive: "ARCHIVING",
      cleanup: "ARCHIVING",
    }[type] as OrchestratorContext["state"];
  }
}
