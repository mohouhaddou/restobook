export type JobResultStatus = "SUCCESS" | "WARNING" | "ERROR" | "SKIPPED";

/** Résultat commun retourné par chaque job orchestré. */
export interface JobResult<T = unknown> {
  readonly jobType: string;
  readonly module: string;
  readonly status: JobResultStatus;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly data?: T;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly errorCode?: string;
}
