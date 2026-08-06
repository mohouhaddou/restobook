import assert from "node:assert/strict";
import test from "node:test";
import { BridgeFactory } from "../bridge/BridgeFactory";

test("l'exécuteur renseigne progression, durée, logs et résultat", async () => {
  const bridge = new BridgeFactory().create();
  const job = await bridge.createJob({ editor: "kids", topic: "Pourquoi le ciel est bleu", language: "fr" });
  await bridge.executeNext();
  assert.equal(job.status, "SUCCESS");
  assert.ok(job.startedAt);
  assert.ok(job.finishedAt);
  assert.ok(job.duration !== undefined && job.duration >= 0);
  assert.ok(job.logs.length >= 10);
  assert.equal(job.errors.length, 0);
});
