import type { CreateJobInput, Job } from "../jobs/Job";
import type { JobManager } from "../jobs/JobManager";
import type { JobQueue } from "../jobs/JobQueue";
import type { EventBus, JobEventListener, JobEventType } from "../jobs/JobEvents";
import type { BridgeHealth, BridgeHealthReport } from "./BridgeHealth";
import type { BridgeMetrics, BridgeMetricsSnapshot } from "./BridgeMetrics";

/** Façade unique exposée aux services Dashboard. */
export class AIBridge {
  public constructor(
    readonly jobs: JobManager, readonly queue: JobQueue, readonly events: EventBus,
    private readonly bridgeHealth: BridgeHealth, private readonly bridgeMetrics: BridgeMetrics,
  ) {}
  public async initialize(): Promise<void> { await this.queue.restore(); }
  public createJob(input: CreateJobInput): Promise<Job> { return this.jobs.create(input); }
  public executeNext(): Promise<Job | undefined> { return this.jobs.processNext(); }
  public executeAll(): Promise<readonly Job[]> { return this.jobs.drain(); }
  public pause(): void { this.jobs.pause(); }
  public resume(): void { this.jobs.resume(); }
  public cancel(id: string): Promise<Job> { return this.jobs.cancel(id); }
  public retry(id: string): Promise<Job> { return this.jobs.retry(id); }
  public on(type: JobEventType | "*", listener: JobEventListener): () => void { return this.events.on(type, listener); }
  public health(): Promise<BridgeHealthReport> { return this.bridgeHealth.check(); }
  public metrics(): BridgeMetricsSnapshot { return this.bridgeMetrics.snapshot(); }
}
