import assert from "node:assert/strict";
import test from "node:test";
import { AIOrchestrator } from "../orchestrator";
import {
  dependencies,
  orchestratorFixture,
  result,
} from "./orchestrator-fixtures";

test("AIOrchestrator exécute le pipeline complet dans l'ordre", async () => {
  const calls: string[] = [];
  const deps = dependencies();
  for (const item of Object.values(deps)) {
    if (item && "execute" in item) {
      const original = item.execute;
      item.execute = async (context) => {
        calls.push(item.name);
        return original(context);
      };
    }
  }
  const orchestrator = new AIOrchestrator(deps, {
    idGenerator: () => "job-complete",
    sleep: async () => undefined,
  });
  const context = await orchestrator.execute(orchestratorFixture);
  assert.equal(context.state, "SUCCESS");
  assert.deepEqual(calls, [
    "FileSystem",
    "Content Manager",
    "Workflow Engine",
    "Publisher Engine",
    "Integration Layer",
    "AI Publisher",
  ]);
  assert.equal(orchestrator.metrics().publications, 1);
});

test("pause, resume, cancel, retry et shutdown contrôlent le cycle de vie", async () => {
  const orchestrator = new AIOrchestrator(dependencies(), {
    idGenerator: () => "job-paused",
    sleep: async () => undefined,
  });
  orchestrator.pause();
  const pending = await orchestrator.execute(orchestratorFixture);
  assert.equal(pending.state, "PENDING");
  orchestrator.cancel(pending.jobId);
  assert.equal(pending.state, "CANCELLED");
  await orchestrator.retry(pending.jobId);
  assert.equal(pending.state, "SUCCESS");
  orchestrator.shutdown();
  assert.equal((await orchestrator.health()).components.Orchestrator, false);
});

test("le retry automatique traite les erreurs récupérables", async () => {
  const deps = dependencies();
  let attempts = 0;
  deps.fileSystem.execute = async () => {
    attempts += 1;
    return attempts === 1 ? result("FileSystem", "ERROR") : result("FileSystem");
  };
  const orchestrator = new AIOrchestrator(deps, {
    idGenerator: () => "job-retry",
    sleep: async () => undefined,
  });
  const context = await orchestrator.execute(orchestratorFixture);
  assert.equal(context.state, "SUCCESS");
  assert.equal(context.attempt, 2);
  assert.equal(orchestrator.metrics().retries, 1);
});
