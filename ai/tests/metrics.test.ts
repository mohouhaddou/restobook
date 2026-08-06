import assert from "node:assert/strict";
import test from "node:test";
import { MetricsCollector } from "../orchestrator";

test("MetricsCollector calcule durées, taux, publications et retries", () => {
  const metrics = new MetricsCollector();
  const common = {
    date: "2026-07-23T17:00:00.000Z",
    workflow: "default",
    editor: "discover" as const,
    module: "test",
    errors: [],
    warnings: [],
  };
  metrics.record({ ...common, jobId: "one", result: "SUCCESS", durationMs: 100, retries: 1 });
  metrics.record({ ...common, jobId: "two", result: "FAILED", durationMs: 300, retries: 0 });
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.publications, 1);
  assert.equal(snapshot.averageDurationMs, 200);
  assert.equal(snapshot.minimumDurationMs, 100);
  assert.equal(snapshot.maximumDurationMs, 300);
  assert.equal(snapshot.successRate, 0.5);
  assert.equal(snapshot.failureRate, 0.5);
  assert.equal(snapshot.retries, 1);
});
