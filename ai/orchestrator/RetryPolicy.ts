export interface RetryPolicyConfiguration {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly backoffMultiplier: number;
  readonly recoverableErrors: readonly string[];
  readonly fatalErrors: readonly string[];
}

/** Décide des retries et calcule un backoff exponentiel déterministe. */
export class RetryPolicy {
  public constructor(public readonly configuration: RetryPolicyConfiguration) {}

  public shouldRetry(attempt: number, errorCode: string): boolean {
    if (attempt >= this.configuration.maxAttempts) return false;
    if (this.configuration.fatalErrors.includes(errorCode)) return false;
    return this.configuration.recoverableErrors.includes(errorCode);
  }

  public delayForAttempt(attempt: number): number {
    return Math.round(
      this.configuration.baseDelayMs
      * this.configuration.backoffMultiplier ** Math.max(0, attempt - 1),
    );
  }
}
