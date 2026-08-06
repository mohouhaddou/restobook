import type { OrchestratorContext } from "../orchestrator/OrchestratorContext";
import type { RetryPolicy } from "../orchestrator/RetryPolicy";
import type { JobResult } from "./JobResult";
import type { OrchestratorJob } from "./PublishJob";

/** Résultat descriptif d'une décision de retry. */
export class RetryJob implements OrchestratorJob {
  public readonly type = "retry";
  public readonly state = "RETRYING" as const;
  public constructor(
    private readonly policy: RetryPolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async execute(context: OrchestratorContext): Promise<JobResult> {
    const started = this.now();
    const errorCode = context.results.at(-1)?.errorCode ?? "UNKNOWN";
    const allowed = this.policy.shouldRetry(context.attempt, errorCode);
    const finished = this.now();
    return {
      jobType: this.type,
      module: "RetryPolicy",
      status: allowed ? "SUCCESS" : "SKIPPED",
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
      durationMs: Math.max(0, finished.getTime() - started.getTime()),
      data: allowed ? { delayMs: this.policy.delayForAttempt(context.attempt) } : undefined,
      errors: [],
      warnings: allowed ? [`Nouvelle tentative ${context.attempt + 1}.`] : [],
    };
  }
}
