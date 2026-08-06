export interface ModuleManifest {
  readonly id: string; readonly version: string; readonly dependencies: readonly string[];
  readonly author: string; readonly description: string; readonly permissions: readonly string[];
  readonly featureFlags: readonly string[]; readonly entryPoint: string; readonly healthCheck: boolean;
}
