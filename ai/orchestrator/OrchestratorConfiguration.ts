import type { RetryPolicyConfiguration } from "./RetryPolicy";

export interface OrchestratorConfiguration {
  readonly concurrency: number;
  readonly autoStart: boolean;
  readonly archiveOnSuccess: boolean;
  readonly retry: RetryPolicyConfiguration;
}

export const DEFAULT_ORCHESTRATOR_CONFIGURATION: OrchestratorConfiguration = {
  concurrency: 1,
  autoStart: true,
  archiveOnSuccess: true,
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    backoffMultiplier: 2,
    recoverableErrors: ["TIMEOUT", "TEMPORARY", "RATE_LIMIT"],
    fatalErrors: ["VALIDATION", "AUTHORIZATION", "UNSUPPORTED_EDITOR"],
  },
};
