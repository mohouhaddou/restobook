import assert from "node:assert/strict";
import test from "node:test";
import { RetryPolicy } from "../orchestrator";

test("RetryPolicy applique maximum, erreurs et backoff exponentiel", () => {
  const policy = new RetryPolicy({
    maxAttempts: 3,
    baseDelayMs: 100,
    backoffMultiplier: 2,
    recoverableErrors: ["TEMPORARY"],
    fatalErrors: ["VALIDATION"],
  });
  assert.equal(policy.shouldRetry(1, "TEMPORARY"), true);
  assert.equal(policy.shouldRetry(3, "TEMPORARY"), false);
  assert.equal(policy.shouldRetry(1, "VALIDATION"), false);
  assert.deepEqual([1, 2, 3].map((attempt) => policy.delayForAttempt(attempt)), [100, 200, 400]);
});
