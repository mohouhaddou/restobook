import assert from "node:assert/strict";
import test from "node:test";
import { OrchestratorQueue } from "../orchestrator";
import { context } from "./orchestrator-fixtures";

test("OrchestratorQueue respecte FIFO et indexe les états", () => {
  const queue = new OrchestratorQueue();
  queue.enqueue(context("one"));
  queue.enqueue(context("two"));
  assert.equal(queue.pendingCount(), 2);
  assert.equal(queue.dequeue()?.jobId, "one");
  assert.equal(queue.get("two").state, "PENDING");
  assert.equal(queue.removePending("two"), true);
  assert.equal(queue.pendingCount(), 0);
});
