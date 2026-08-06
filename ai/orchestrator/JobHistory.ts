import type { EditorId } from "../types";

export interface JobHistoryEntry {
  readonly date: string;
  readonly jobId: string;
  readonly workflow: string;
  readonly editor: EditorId;
  readonly module: string;
  readonly result: "SUCCESS" | "FAILED" | "CANCELLED";
  readonly durationMs: number;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly retries: number;
}

/** Historique immutable en mémoire des exécutions terminées. */
export class JobHistory {
  private readonly entries: JobHistoryEntry[] = [];
  public add(entry: JobHistoryEntry): void {
    this.entries.push(structuredClone(entry));
  }
  public list(jobId?: string): readonly JobHistoryEntry[] {
    return this.entries
      .filter((entry) => !jobId || entry.jobId === jobId)
      .map((entry) => structuredClone(entry));
  }
}
