import type { OrchestratorEventType } from "./OrchestratorEvents";

export interface OrchestratorLogEntry {
  readonly timestamp: string;
  readonly level: "info" | "warning" | "error";
  readonly event: OrchestratorEventType;
  readonly jobId?: string;
  readonly message: string;
}

export class OrchestratorLogger {
  private readonly entries: OrchestratorLogEntry[] = [];
  public constructor(private readonly now: () => Date = () => new Date()) {}
  public log(entry: Omit<OrchestratorLogEntry, "timestamp">): OrchestratorLogEntry {
    const complete = { ...entry, timestamp: this.now().toISOString() };
    this.entries.push(complete);
    return { ...complete };
  }
  public list(jobId?: string): readonly OrchestratorLogEntry[] {
    return this.entries
      .filter((entry) => !jobId || entry.jobId === jobId)
      .map((entry) => ({ ...entry }));
  }
}
