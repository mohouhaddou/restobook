import type { OrchestratorJobState } from "./OrchestratorContext";
import { OrchestratorQueue } from "./OrchestratorQueue";

export interface OrchestratorMonitorSnapshot {
  readonly total: number;
  readonly pending: number;
  readonly byState: Readonly<Partial<Record<OrchestratorJobState, number>>>;
}

/** Vue en lecture seule de la file. */
export class OrchestratorMonitor {
  public constructor(private readonly queue: OrchestratorQueue) {}
  public snapshot(): OrchestratorMonitorSnapshot {
    const jobs = this.queue.list();
    const byState: Partial<Record<OrchestratorJobState, number>> = {};
    for (const job of jobs) byState[job.state] = (byState[job.state] ?? 0) + 1;
    return { total: jobs.length, pending: this.queue.pendingCount(), byState };
  }
}
