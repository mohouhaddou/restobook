import type { JobRetryConfiguration } from "../jobs/JobRetryPolicy";

export interface BridgeConfiguration {
  readonly defaultProvider: string;
  readonly defaultModel: string;
  readonly concurrency: number;
  readonly autoResume: boolean;
  readonly persistencePath?: string;
  readonly retry: JobRetryConfiguration;
}
