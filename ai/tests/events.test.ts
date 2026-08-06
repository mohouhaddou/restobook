import assert from "node:assert/strict";
import test from "node:test";
import { EventBus } from "../jobs/JobEvents";

test("EventBus diffuse les événements ciblés et globaux", async () => {
  const bus = new EventBus();
  const received: string[] = [];
  bus.on("JOB_CREATED", event => received.push(`target:${event.type}`));
  bus.on("*", event => received.push(`all:${event.type}`));
  await bus.emit({ type: "JOB_CREATED", timestamp: new Date().toISOString() });
  assert.deepEqual(received, ["target:JOB_CREATED", "all:JOB_CREATED"]);
});
