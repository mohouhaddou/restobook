import assert from "node:assert/strict";
import test from "node:test";
import { BridgeFactory } from "../bridge/BridgeFactory";
import { DashboardNotificationService } from "../dashboard/DashboardNotificationService";

test("les événements Bridge sont traduits en événements WebSocket publics", async () => {
  const bridge = new BridgeFactory().create();
  const emitted: string[] = [];
  const notifications = new DashboardNotificationService(bridge, { emit: event => emitted.push(event) });
  notifications.start();
  await bridge.createJob({ editor: "sports", topic: "Finale 2026", language: "fr" });
  await bridge.executeAll();
  notifications.stop();
  assert.ok(emitted.includes("job-created"));
  assert.ok(emitted.includes("job-progress"));
  assert.ok(emitted.includes("job-success"));
});
