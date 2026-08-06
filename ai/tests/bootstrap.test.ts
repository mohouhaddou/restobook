import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import defaultJson from "../config/default.json";
import testJson from "../config/test.json";
import {
  Bootstrap,
  BootstrapValidator,
  type BootstrapConfiguration,
} from "../bootstrap";
import { demoAll } from "../demo";

const aiRoot = path.resolve(process.cwd());

test("BootstrapValidator valide architecture, configuration et dépendances", async () => {
  const result = await new BootstrapValidator(aiRoot)
    .validate(defaultJson as BootstrapConfiguration);
  assert.equal(result.valid, true);
  assert.equal(result.circularDependencies.length, 0);
  assert.ok(result.fileCount > 100);
  assert.ok(result.checks.some((check) => check.name === "Orchestrator" && check.valid));
});

test("Bootstrap produit le rapport global et le tableau de bord", async () => {
  const { report, dashboard } = await new Bootstrap({
    aiRoot,
    configuration: testJson as BootstrapConfiguration,
    testsExecuted: 70,
    testsPassed: 70,
    now: () => new Date("2026-07-23T18:00:00.000Z"),
  }).run();
  assert.equal(report.summary, "READY");
  assert.equal(report.testsPassed, 70);
  assert.ok(report.disabledModules.includes("aiPublisher"));
  assert.ok(dashboard.includes("iFilino AI Editorial Platform"));
  assert.ok(dashboard.includes("READY"));
});

test("demo-all simule les cinq pipelines complets", async () => {
  const report = await demoAll();
  assert.equal(report.status, "SUCCESS");
  assert.equal(report.publications, 5);
  assert.deepEqual(report.reports.map((item) => item.editor), [
    "discover",
    "sports",
    "kids",
    "stories",
    "gaming",
  ]);
  assert.ok(report.reports.every((item) => item.steps.length === 7));
});
