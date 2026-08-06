import type { OrchestratorDependencies, OrchestratorContext } from "./OrchestratorContext";
import { OrchestratorExecutionError } from "./OrchestratorErrors";
import { OrchestratorEventBus } from "./OrchestratorEvents";
import { OrchestratorLogger } from "./OrchestratorLogger";
import { OrchestratorPipeline } from "./OrchestratorPipeline";

/** Exécute une tentative de pipeline dans l'ordre et s'arrête à la première erreur. */
export class OrchestratorExecutor {
  public constructor(
    private readonly dependencies: OrchestratorDependencies,
    private readonly events: OrchestratorEventBus,
    private readonly logger: OrchestratorLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async execute(
    context: OrchestratorContext,
    pipeline: OrchestratorPipeline,
  ): Promise<boolean> {
    for (const job of pipeline.jobs(this.dependencies)) {
      if (context.cancelled) {
        context.state = "CANCELLED";
        return false;
      }
      context.state = job.state;
      this.emit(context, "job:state", `Exécution de ${job.type}.`);
      try {
        const result = await job.execute(context);
        context.results.push(result);
        context.errors.push(...result.errors);
        context.warnings.push(...result.warnings);
        if (result.status === "ERROR") return false;
      } catch (error) {
        const wrapped = new OrchestratorExecutionError(
          error instanceof Error ? error.message : String(error),
          error,
        );
        context.errors.push(wrapped.message);
        context.results.push({
          jobType: job.type,
          module: "OrchestratorExecutor",
          status: "ERROR",
          startedAt: this.now().toISOString(),
          finishedAt: this.now().toISOString(),
          durationMs: 0,
          errors: [wrapped.message],
          warnings: [],
          errorCode: wrapped.code,
        });
        return false;
      }
    }
    return true;
  }

  private emit(
    context: OrchestratorContext,
    type: "job:state",
    message: string,
  ): void {
    this.events.emit({
      type,
      jobId: context.jobId,
      state: context.state,
      timestamp: this.now().toISOString(),
      message,
    });
    this.logger.log({ level: "info", event: type, jobId: context.jobId, message });
  }
}
