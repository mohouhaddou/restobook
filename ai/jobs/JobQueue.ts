import type { Job } from "./Job";
import { JOB_PRIORITY_WEIGHT } from "./JobPriority";
import type { JobPersistence } from "./JobPersistence";
import { TERMINAL_JOB_STATUSES } from "./JobStatus";

/** File prioritaire stable. À priorité égale, le plus ancien passe en premier. */
export class JobQueue {
  private readonly jobs = new Map<string, Job>();
  private paused = false;
  public constructor(private readonly persistence: JobPersistence) {}

  public async restore(): Promise<void> {
    for (const job of await this.persistence.load()) {
      if (!TERMINAL_JOB_STATUSES.includes(job.status)) {
        job.status = job.status === "PAUSED" ? "PAUSED" : "PENDING";
        this.jobs.set(job.id, job);
      }
    }
  }
  public async enqueue(job: Job): Promise<void> { this.jobs.set(job.id, job); await this.persist(); }
  public next(): Job | undefined {
    if (this.paused) return undefined;
    return [...this.jobs.values()]
      .filter(job => job.status === "PENDING" || job.status === "RETRYING")
      .filter(job => !job.nextAttemptAt || Date.parse(job.nextAttemptAt) <= Date.now())
      .sort((a, b) => JOB_PRIORITY_WEIGHT[b.priority] - JOB_PRIORITY_WEIGHT[a.priority] || a.createdAt.localeCompare(b.createdAt))[0];
  }
  public get(id: string): Job | undefined { return this.jobs.get(id); }
  public list(): readonly Job[] { return [...this.jobs.values()]; }
  public pause(): void { this.paused = true; }
  public resume(): void { this.paused = false; }
  public isPaused(): boolean { return this.paused; }
  public async remove(id: string): Promise<boolean> { const removed = this.jobs.delete(id); await this.persist(); return removed; }
  public async persist(): Promise<void> { await this.persistence.save(this.list()); }
}
