import assert from "node:assert/strict";
import test from "node:test";
import { OrchestratorScheduler } from "../orchestrator";

test("OrchestratorScheduler planifie, liste et annule sans auto-démarrage", async () => {
  const scheduler = new OrchestratorScheduler();
  let called = false;
  scheduler.schedule("future", new Date(Date.now() + 60_000), () => {
    called = true;
  });
  assert.deepEqual(scheduler.list(), ["future"]);
  assert.equal(called, false);
  assert.equal(scheduler.cancel("future"), true);

  await new Promise<void>((resolve) => {
    scheduler.schedule("now", new Date(0), () => {
      called = true;
      resolve();
    });
  });
  assert.equal(called, true);
  scheduler.shutdown();
  assert.deepEqual(scheduler.list(), []);
});
