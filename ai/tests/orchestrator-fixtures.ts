import fixtureJson from "../examples/discover-package.json";
import type { JobResult } from "../jobs";
import type {
  OrchestratorContext,
  OrchestratorDependencies,
  OrchestratorModulePort,
} from "../orchestrator";
import type { ContentPackage } from "../types";

export const orchestratorFixture = fixtureJson as ContentPackage;

export function result(module: string, status: JobResult["status"] = "SUCCESS"): JobResult {
  return {
    jobType: "test",
    module,
    status,
    startedAt: "2026-07-23T17:00:00.000Z",
    finishedAt: "2026-07-23T17:00:00.001Z",
    durationMs: 1,
    errors: status === "ERROR" ? [`${module} failed`] : [],
    warnings: [],
    errorCode: status === "ERROR" ? "TEMPORARY" : undefined,
  };
}

export function port(name: string): OrchestratorModulePort {
  return {
    name,
    execute: async () => result(name),
    health: async () => true,
  };
}

export function dependencies(): OrchestratorDependencies {
  return {
    contentManager: port("Content Manager"),
    workflowEngine: port("Workflow Engine"),
    publisherEngine: port("Publisher Engine"),
    fileSystem: port("FileSystem"),
    integrationLayer: port("Integration Layer"),
    aiPublisher: port("AI Publisher"),
  };
}

export function context(id = "job-1"): OrchestratorContext {
  return {
    jobId: id,
    workflowId: "default",
    editor: orchestratorFixture.editor,
    package: orchestratorFixture,
    state: "PENDING",
    attempt: 1,
    createdAt: "2026-07-23T17:00:00.000Z",
    results: [],
    errors: [],
    warnings: [],
    cancelled: false,
  };
}
