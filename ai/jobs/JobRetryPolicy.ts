export interface JobRetryConfiguration {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly multiplier: number;
  readonly maxDelayMs: number;
  readonly recoverableErrors: readonly string[];
}

export const DEFAULT_JOB_RETRY_CONFIGURATION: JobRetryConfiguration = {
  maxAttempts: 3, initialDelayMs: 250, multiplier: 2, maxDelayMs: 30_000,
  recoverableErrors: ["TIMEOUT", "RATE_LIMIT", "PROVIDER_UNAVAILABLE"],
};

export class JobRetryPolicy {
  public constructor(readonly configuration = DEFAULT_JOB_RETRY_CONFIGURATION) {}
  public canRetry(attempts: number, code = "PROVIDER_UNAVAILABLE"): boolean {
    return attempts < this.configuration.maxAttempts && this.configuration.recoverableErrors.includes(code);
  }
  public delay(attempts: number): number {
    return Math.min(this.configuration.initialDelayMs * this.configuration.multiplier ** Math.max(0, attempts - 1), this.configuration.maxDelayMs);
  }
}
