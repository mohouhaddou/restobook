import type { JobEvent } from "../jobs/JobEvents";

export interface BridgeMetricsSnapshot {
  readonly created: number; readonly succeeded: number; readonly failed: number;
  readonly retries: number; readonly successRate: number; readonly averageDurationMs: number;
}
export class BridgeMetrics {
  private created = 0; private succeeded = 0; private failed = 0; private retries = 0;
  private readonly durations: number[] = [];
  public record(event: JobEvent): void {
    if (event.type === "JOB_CREATED") this.created++;
    if (event.type === "JOB_SUCCESS") { this.succeeded++; if (event.job?.duration !== undefined) this.durations.push(event.job.duration); }
    if (event.type === "JOB_FAILED") this.failed++;
    if (event.job?.status === "RETRYING") this.retries++;
  }
  public snapshot(): BridgeMetricsSnapshot {
    const finished = this.succeeded + this.failed;
    return { created: this.created, succeeded: this.succeeded, failed: this.failed, retries: this.retries,
      successRate: finished ? this.succeeded / finished : 1,
      averageDurationMs: this.durations.length ? this.durations.reduce((a, b) => a + b, 0) / this.durations.length : 0 };
  }
}
