import assert from "node:assert/strict";
import test from "node:test";
import { JobFactory, RetryJob } from "../jobs";
import { RetryPolicy } from "../orchestrator";
import { context, port } from "./orchestrator-fixtures";

test("JobFactory crée les cinq types de jobs communs", async () => {
  const factory = new JobFactory();
  const module = port("test-module");
  for (const type of ["validation", "import", "publish", "archive", "cleanup"] as const) {
    const job = factory.create(type, module);
    const result = await job.execute(context(type));
    assert.equal(result.status, "SUCCESS");
  }
});

test("RetryJob décrit la décision sans relancer lui-même le pipeline", async () => {
  const policy = new RetryPolicy({
    maxAttempts: 2,
    baseDelayMs: 10,
    backoffMultiplier: 2,
    recoverableErrors: ["TEMPORARY"],
    fatalErrors: [],
  });
  const jobContext = context();
  jobContext.results.push({
    jobType: "publish",
    module: "test",
    status: "ERROR",
    startedAt: jobContext.createdAt,
    finishedAt: jobContext.createdAt,
    durationMs: 0,
    errors: ["temporary"],
    warnings: [],
    errorCode: "TEMPORARY",
  });
  const result = await new RetryJob(policy).execute(jobContext);
  assert.equal(result.status, "SUCCESS");
  assert.deepEqual(result.data, { delayMs: 10 });
});
