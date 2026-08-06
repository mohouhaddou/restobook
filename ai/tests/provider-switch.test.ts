import assert from "node:assert/strict";
import test from "node:test";
import { BridgeFactory } from "../bridge/BridgeFactory";
import { DashboardJobService } from "../dashboard/DashboardJobService";
import type { AIProvider } from "../providers/AIProvider";

test("changer de provider ne modifie pas le contrat Dashboard", async () => {
  const alternate: AIProvider = {
    id: "alternate",
    async health() { return true; },
    async generate(request) { return { provider: "alternate", model: request.model, content: `# ${request.prompt}`, latencyMs: 1 }; },
  };
  const bridge = new BridgeFactory().create({
    defaultProvider: "alternate", defaultModel: "alternate-v1", concurrency: 1, autoResume: true,
    retry: { maxAttempts: 1, initialDelayMs: 1, multiplier: 2, maxDelayMs: 2, recoverableErrors: [] },
  }, { providers: [alternate] });
  const dashboard = new DashboardJobService(bridge);
  const job = await dashboard.create({ editor: "gaming", topic: "Nouveau jeu indépendant", language: "fr" });
  await bridge.executeAll();
  assert.equal(job.provider, "alternate");
  assert.equal(job.status, "SUCCESS");
});
