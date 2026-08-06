import { randomUUID } from "node:crypto";
import type { ContentPackage } from "../types";
import { HealthCheck, type HealthCheckReport } from "./HealthCheck";
import { JobHistory, type JobHistoryEntry } from "./JobHistory";
import { MetricsCollector, type OrchestratorMetrics } from "./MetricsCollector";
import {
  DEFAULT_ORCHESTRATOR_CONFIGURATION,
  type OrchestratorConfiguration,
} from "./OrchestratorConfiguration";
import type {
  OrchestratorContext,
  OrchestratorDependencies,
} from "./OrchestratorContext";
import { OrchestratorExecutor } from "./OrchestratorExecutor";
import { OrchestratorJobNotFoundError, OrchestratorStateError } from "./OrchestratorErrors";
import { OrchestratorEventBus, type OrchestratorEventType } from "./OrchestratorEvents";
import { OrchestratorLogger } from "./OrchestratorLogger";
import { OrchestratorMonitor } from "./OrchestratorMonitor";
import { OrchestratorPipeline } from "./OrchestratorPipeline";
import { OrchestratorQueue } from "./OrchestratorQueue";
import { OrchestratorScheduler, type ScheduledJob } from "./OrchestratorScheduler";
import { RetryPolicy } from "./RetryPolicy";

export interface AIOrchestratorOptions {
  readonly configuration?: OrchestratorConfiguration;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

/** Façade complète et configurable de coordination du pipeline IA. */
export class AIOrchestrator {
  public readonly queue = new OrchestratorQueue();
  public readonly scheduler = new OrchestratorScheduler();
  public readonly history = new JobHistory();
  public readonly metricsCollector = new MetricsCollector();
  public readonly events = new OrchestratorEventBus();
  public readonly logger: OrchestratorLogger;
  public readonly monitor = new OrchestratorMonitor(this.queue);

  private readonly workflows = new Map<string, OrchestratorPipeline>();
  private readonly configuration: OrchestratorConfiguration;
  private readonly retryPolicy: RetryPolicy;
  private readonly executor: OrchestratorExecutor;
  private readonly healthCheck: HealthCheck;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private paused = false;
  private stopped = false;

  public constructor(
    private readonly dependencies: OrchestratorDependencies,
    options: AIOrchestratorOptions = {},
  ) {
    this.configuration = options.configuration ?? DEFAULT_ORCHESTRATOR_CONFIGURATION;
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.sleep = options.sleep
      ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.retryPolicy = new RetryPolicy(this.configuration.retry);
    this.logger = new OrchestratorLogger(this.now);
    this.executor = new OrchestratorExecutor(
      dependencies,
      this.events,
      this.logger,
      this.now,
    );
    this.healthCheck = new HealthCheck(
      dependencies,
      () => !this.stopped,
      this.now,
    );
    this.registerWorkflow(
      OrchestratorPipeline.default(
        this.configuration.archiveOnSuccess && Boolean(dependencies.archive),
      ),
    );
  }

  public registerWorkflow(workflow: OrchestratorPipeline): void {
    this.workflows.set(workflow.id, workflow);
  }

  public async execute(
    content: ContentPackage,
    workflowId = "default",
  ): Promise<OrchestratorContext> {
    if (this.stopped) throw new OrchestratorStateError("L'orchestrateur est arrêté.");
    if (!this.workflows.has(workflowId)) {
      throw new OrchestratorStateError(`Workflow inconnu : ${workflowId}.`);
    }
    const context: OrchestratorContext = {
      jobId: this.idGenerator(),
      workflowId,
      editor: content.editor,
      package: structuredClone(content),
      state: "PENDING",
      attempt: 1,
      createdAt: this.now().toISOString(),
      results: [],
      errors: [],
      warnings: [],
      cancelled: false,
    };
    this.queue.enqueue(context);
    this.emit("job:queued", context, "Job ajouté à la file.");
    if (this.configuration.autoStart && !this.paused) {
      this.queue.removePending(context.jobId);
      await this.run(context);
    }
    return context;
  }

  public pause(): void {
    this.paused = true;
    this.emit("orchestrator:paused", undefined, "Orchestrateur en pause.");
  }

  public async resume(): Promise<void> {
    if (this.stopped) throw new OrchestratorStateError("L'orchestrateur est arrêté.");
    this.paused = false;
    this.emit("orchestrator:resumed", undefined, "Orchestrateur repris.");
    while (this.queue.pendingCount() > 0 && !this.paused) {
      const batch: OrchestratorContext[] = [];
      while (batch.length < this.configuration.concurrency) {
        const context = this.queue.dequeue();
        if (!context) break;
        batch.push(context);
      }
      await Promise.all(batch.map((context) => this.run(context)));
    }
  }

  public cancel(jobId: string): OrchestratorContext {
    const context = this.queue.get(jobId);
    context.cancelled = true;
    context.state = "CANCELLED";
    context.finishedAt = this.now().toISOString();
    this.queue.removePending(jobId);
    this.emit("job:cancelled", context, "Job annulé.");
    return context;
  }

  public async retry(jobId: string): Promise<OrchestratorContext> {
    const context = this.queue.get(jobId);
    if (!["FAILED", "CANCELLED"].includes(context.state)) {
      throw new OrchestratorStateError(`Le job ${jobId} ne peut pas être relancé.`);
    }
    context.cancelled = false;
    context.state = "RETRYING";
    context.attempt += 1;
    this.emit("job:retry", context, "Retry manuel.");
    await this.run(context);
    return context;
  }

  public schedule(
    content: ContentPackage,
    date: Date,
    workflowId = "default",
  ): ScheduledJob {
    if (this.stopped) throw new OrchestratorStateError("L'orchestrateur est arrêté.");
    const scheduleId = this.idGenerator();
    return this.scheduler.schedule(scheduleId, date, async () => {
      await this.execute(content, workflowId);
    });
  }

  public shutdown(): void {
    this.stopped = true;
    this.paused = true;
    this.scheduler.shutdown();
    this.queue.clear();
    this.emit("orchestrator:shutdown", undefined, "Orchestrateur arrêté.");
  }

  public health(): Promise<HealthCheckReport> {
    return this.healthCheck.check();
  }

  public metrics(): OrchestratorMetrics {
    return this.metricsCollector.snapshot();
  }

  private async run(context: OrchestratorContext): Promise<void> {
    const pipeline = this.workflows.get(context.workflowId);
    if (!pipeline) throw new OrchestratorJobNotFoundError(context.workflowId);
    const started = this.now();
    context.startedAt = started.toISOString();
    this.emit("job:started", context, "Exécution démarrée.");

    while (!context.cancelled) {
      const success = await this.executor.execute(context, pipeline);
      if (success) {
        context.state = "SUCCESS";
        break;
      }
      if (context.cancelled) {
        context.state = "CANCELLED";
        break;
      }
      const errorCode = context.results.at(-1)?.errorCode ?? "UNKNOWN";
      if (!this.retryPolicy.shouldRetry(context.attempt, errorCode)) {
        context.state = "FAILED";
        break;
      }
      context.state = "RETRYING";
      this.emit("job:retry", context, `Retry automatique ${context.attempt + 1}.`);
      await this.sleep(this.retryPolicy.delayForAttempt(context.attempt));
      context.attempt += 1;
    }

    const finished = this.now();
    context.finishedAt = finished.toISOString();
    const entry: JobHistoryEntry = {
      date: finished.toISOString(),
      jobId: context.jobId,
      workflow: context.workflowId,
      editor: context.editor,
      module: context.results.at(-1)?.module ?? "Orchestrator",
      result: context.state === "SUCCESS"
        ? "SUCCESS"
        : context.state === "CANCELLED" ? "CANCELLED" : "FAILED",
      durationMs: Math.max(0, finished.getTime() - started.getTime()),
      errors: [...context.errors],
      warnings: [...context.warnings],
      retries: Math.max(0, context.attempt - 1),
    };
    this.history.add(entry);
    this.metricsCollector.record(entry);
    this.emit(
      context.state === "SUCCESS"
        ? "job:success"
        : context.state === "CANCELLED" ? "job:cancelled" : "job:failed",
      context,
      `Job terminé avec l'état ${context.state}.`,
    );
  }

  private emit(
    type: OrchestratorEventType,
    context: OrchestratorContext | undefined,
    message: string,
  ): void {
    this.events.emit({
      type,
      jobId: context?.jobId,
      state: context?.state,
      timestamp: this.now().toISOString(),
      message,
    });
    this.logger.log({
      level: type === "job:failed" ? "error" : "info",
      event: type,
      jobId: context?.jobId,
      message,
    });
  }
}
