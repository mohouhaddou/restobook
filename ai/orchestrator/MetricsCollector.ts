import type { JobHistoryEntry } from "./JobHistory";

export interface OrchestratorMetrics {
  readonly publications: number;
  readonly averageDurationMs: number;
  readonly maximumDurationMs: number;
  readonly minimumDurationMs: number;
  readonly successRate: number;
  readonly failureRate: number;
  readonly retries: number;
  readonly averageWorkflowDurationMs: number;
}

export class MetricsCollector {
  private readonly records: JobHistoryEntry[] = [];
  public record(entry: JobHistoryEntry): void {
    this.records.push(structuredClone(entry));
  }
  public snapshot(): OrchestratorMetrics {
    const count = this.records.length;
    const durations = this.records.map((entry) => entry.durationMs);
    const successes = this.records.filter((entry) => entry.result === "SUCCESS").length;
    const failures = this.records.filter((entry) => entry.result === "FAILED").length;
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    return {
      publications: successes,
      averageDurationMs: count ? total / count : 0,
      maximumDurationMs: count ? Math.max(...durations) : 0,
      minimumDurationMs: count ? Math.min(...durations) : 0,
      successRate: count ? successes / count : 0,
      failureRate: count ? failures / count : 0,
      retries: this.records.reduce((sum, entry) => sum + entry.retries, 0),
      averageWorkflowDurationMs: count ? total / count : 0,
    };
  }
}
