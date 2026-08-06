import type { JobManager } from "./JobManager";
import type { CreateJobInput } from "./Job";

export interface ScheduledJob { readonly id: string; readonly runAt: string; readonly input: CreateJobInput; }

/** Planificateur injecté; aucun timer n'est démarré automatiquement. */
export class JobScheduler {
  private readonly scheduled = new Map<string, ScheduledJob>();
  public constructor(private readonly manager: JobManager) {}
  public schedule(job: ScheduledJob): void { this.scheduled.set(job.id, job); }
  public cancel(id: string): boolean { return this.scheduled.delete(id); }
  public list(): readonly ScheduledJob[] { return [...this.scheduled.values()]; }
  public async tick(now = new Date()): Promise<number> {
    const due = this.list().filter(item => Date.parse(item.runAt) <= now.getTime());
    for (const item of due) { await this.manager.create(item.input); this.scheduled.delete(item.id); }
    return due.length;
  }
}
