import assert from "node:assert/strict";
import test from "node:test";
import { MockProvider } from "../providers/MockProvider";
import { ProviderRegistry } from "../providers/ProviderRegistry";
import { ProviderSelector } from "../providers/ProviderSelector";
import type { Job } from "../jobs/Job";

test("le provider se sélectionne derrière le port commun", async () => {
  const registry = new ProviderRegistry();
  registry.register(new MockProvider());
  const job = { provider: undefined } as unknown as Job;
  assert.equal((await new ProviderSelector(registry, "mock").select(job)).id, "mock");
});
