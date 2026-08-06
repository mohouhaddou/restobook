import assert from "node:assert/strict";
import test from "node:test";
import { HealthCheck } from "../orchestrator";
import { dependencies } from "./orchestrator-fixtures";

test("HealthCheck vérifie les sept composants", async () => {
  const report = await new HealthCheck(
    dependencies(),
    () => true,
    () => new Date("2026-07-23T17:00:00.000Z"),
  ).check();
  assert.equal(report.healthy, true);
  assert.equal(Object.keys(report.components).length, 7);
  assert.equal(report.components["Workflow Engine"], true);
  assert.equal(report.components["AI Publisher"], true);
});

test("HealthCheck isole une probe défaillante", async () => {
  const deps = dependencies();
  deps.publisherEngine.health = async () => {
    throw new Error("offline");
  };
  const report = await new HealthCheck(deps, () => true).check();
  assert.equal(report.healthy, false);
  assert.equal(report.components["Publisher Engine"], false);
});
