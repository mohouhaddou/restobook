import type { ContentPackage, EditorId } from "../types";
import type { JobResult } from "../jobs/JobResult";

export type OrchestratorJobState =
  | "PENDING"
  | "VALIDATING"
  | "IMPORTING"
  | "PUBLISHING"
  | "ARCHIVING"
  | "SUCCESS"
  | "FAILED"
  | "RETRYING"
  | "CANCELLED";

/** Port d'un module coordonné. Les implémentations sont injectées. */
export interface OrchestratorModulePort {
  readonly name: string;
  execute(context: OrchestratorContext): Promise<JobResult>;
  health(): Promise<boolean>;
}

/** Hooks déclaratifs, jamais invoqués sans implémentation injectée. */
export interface OrchestratorHooks {
  readonly notifications?: (result: JobResult) => Promise<void>;
  readonly webhooks?: (result: JobResult) => Promise<void>;
  readonly slack?: (result: JobResult) => Promise<void>;
  readonly discord?: (result: JobResult) => Promise<void>;
  readonly email?: (result: JobResult) => Promise<void>;
}

export interface OrchestratorDependencies {
  readonly contentManager: OrchestratorModulePort;
  readonly workflowEngine: OrchestratorModulePort;
  readonly publisherEngine: OrchestratorModulePort;
  readonly fileSystem: OrchestratorModulePort;
  readonly integrationLayer: OrchestratorModulePort;
  readonly aiPublisher: OrchestratorModulePort;
  readonly archive?: OrchestratorModulePort;
  readonly hooks?: OrchestratorHooks;
}

/** Contexte mutable uniquement par l'orchestrateur pendant une exécution. */
export interface OrchestratorContext {
  readonly jobId: string;
  readonly workflowId: string;
  readonly editor: EditorId;
  readonly package: ContentPackage;
  state: OrchestratorJobState;
  attempt: number;
  readonly createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  readonly results: JobResult[];
  readonly errors: string[];
  readonly warnings: string[];
  cancelled: boolean;
}
