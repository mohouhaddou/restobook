import assert from "node:assert/strict";
import test from "node:test";
import { BridgeFactory } from "../bridge/BridgeFactory";
import { DashboardJobService } from "../dashboard/DashboardJobService";

test("le Dashboard crée un job puis le Bridge exécute tout le pipeline Mock", async () => {
  const bridge = new BridgeFactory().create();
  await bridge.initialize();
  const dashboard = new DashboardJobService(bridge);
  const job = await dashboard.create({ editor: "discover", topic: "Les océans lumineux", language: "fr" });
  const events: string[] = [];
  bridge.on("*", event => events.push(event.type));
  await bridge.executeAll();
  assert.equal(job.status, "SUCCESS");
  assert.equal(job.progress, 100);
  assert.equal(job.result?.contentPackage?.metadata.title, "Les océans lumineux");
  assert.equal(job.result?.published, true);
  assert.deepEqual(events.filter(type => type === "PROVIDER_SELECTED" || type === "EDITOR_SELECTED" || type === "PACKAGE_READY" || type === "JOB_SUCCESS"),
    ["PROVIDER_SELECTED", "EDITOR_SELECTED", "PACKAGE_READY", "JOB_SUCCESS"]);
});
