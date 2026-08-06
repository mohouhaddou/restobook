import type { CreateJobInput, Job } from "./Job";
import type { JobQueue } from "./JobQueue";
import type { JobExecutor } from "./JobExecutor";
import type { EventBus } from "./JobEvents";
import type { JobRetryPolicy } from "./JobRetryPolicy";
import { JobNotFoundError } from "../bridge/BridgeErrors";

export class JobManager {
  private sequence = 0;
  private running = false;
  public constructor(
    private readonly queue: JobQueue, private readonly executor: JobExecutor,
    private readonly events: EventBus, private readonly retryPolicy: JobRetryPolicy,
    private readonly now = () => new Date(),
  ) {}

  public async create(input: CreateJobInput): Promise<Job> {
    const timestamp = this.now().toISOString();
    const job: Job = { id: `JOB-${Date.now()}-${++this.sequence}`, editor: input.editor, provider: input.provider,
      topic: input.topic, language: input.language, status: "PENDING", progress: 0, priority: input.priority ?? "NORMAL",
      createdAt: timestamp, attempts: 0, logs: [], warnings: [], errors: [] };
    await this.queue.enqueue(job);
    await this.events.emit({ type: "JOB_CREATED", jobId: job.id, job, timestamp });
    await this.queueEvent();
    return job;
  }
  public async processNext(): Promise<Job | undefined> {
    const job = this.queue.next();
    if (!job) return undefined;
    try { await this.executor.execute(job); }
    catch (error) {
      const code = error instanceof Error ? error.message : "PROVIDER_UNAVAILABLE";
      if (this.retryPolicy.canRetry(job.attempts, code)) {
        job.status = "RETRYING";
        job.nextAttemptAt = new Date(this.now().getTime() + this.retryPolicy.delay(job.attempts)).toISOString();
      }
    }
    await this.queue.persist(); await this.queueEvent();
    return job;
  }
  public async drain(): Promise<readonly Job[]> {
    if (this.running) return [];
    this.running = true;
    const completed: Job[] = [];
    try { let job: Job | undefined; while ((job = await this.processNext())) completed.push(job); }
    finally { this.running = false; }
    return completed;
  }
  public pause(): void { this.queue.pause(); }
  public resume(): void { this.queue.resume(); }
  public async cancel(id: string): Promise<Job> { const job = this.require(id); job.status = "CANCELLED"; job.finishedAt = this.now().toISOString(); await this.queue.persist(); await this.queueEvent(); return job; }
  public async retry(id: string): Promise<Job> { const job = this.require(id); job.status = "PENDING"; job.progress = 0; job.finishedAt = undefined; job.nextAttemptAt = undefined; job.errors = []; await this.queue.persist(); await this.queueEvent(); return job; }
  public async reprioritize(id: string, priority: Job["priority"]): Promise<Job> { const job = this.require(id); job.priority = priority; await this.queue.persist(); await this.queueEvent(); return job; }
  public get(id: string): Job { return this.require(id); }
  public list(): readonly Job[] { return this.queue.list(); }
  private require(id: string): Job { const job = this.queue.get(id); if (!job) throw new JobNotFoundError(id); return job; }
  private async queueEvent(): Promise<void> { await this.events.emit({ type: "QUEUE_UPDATED", timestamp: this.now().toISOString(), payload: { count: this.queue.list().length, paused: this.queue.isPaused() } }); }
}
