export type BootstrapEnvironment = "default" | "development" | "production" | "test";

export interface BootstrapModuleConfiguration {
  readonly workflowEngine: boolean;
  readonly publisherEngine: boolean;
  readonly contentManager: boolean;
  readonly fileSystem: boolean;
  readonly integration: boolean;
  readonly aiPublisher: boolean;
  readonly orchestrator: boolean;
}

/** Configuration complète et sérialisable du bootstrap. */
export interface BootstrapConfiguration {
  readonly version: string;
  readonly environment: BootstrapEnvironment;
  readonly workspace: { readonly root: string; readonly temporary: string };
  readonly logs: { readonly directory: string; readonly level: "debug" | "info" | "warning" | "error" };
  readonly retry: {
    readonly maxAttempts: number;
    readonly baseDelayMs: number;
    readonly backoffMultiplier: number;
  };
  readonly scheduler: { readonly enabled: boolean; readonly concurrency: number };
  readonly publisher: { readonly requireImages: boolean; readonly dryRun: boolean };
  readonly orchestrator: { readonly autoStart: boolean; readonly archiveOnSuccess: boolean };
  readonly modules: BootstrapModuleConfiguration;
  readonly featureFlags: Readonly<Record<string, boolean>>;
}
