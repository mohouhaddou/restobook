import assert from "node:assert/strict";
import test from "node:test";
import {
  DiscoverAdapter,
  GamingAdapter,
  KidsAdapter,
  SportsAdapter,
  StoriesAdapter,
} from "../adapters";
import { IntegrationRegistry } from "../integration";

test("tous les adapters implémentent le contrat commun", () => {
  const registry = new IntegrationRegistry();
  const adapters = [
    new DiscoverAdapter(),
    new SportsAdapter(),
    new KidsAdapter(),
    new StoriesAdapter(),
    new GamingAdapter(),
  ];
  for (const adapter of adapters) registry.register(adapter);

  assert.deepEqual(
    registry.list().map((adapter) => [adapter.id, adapter.targetProduct]),
    [
      ["discover", "Discover"],
      ["gaming", "GamingHub"],
      ["kids", "Kids"],
      ["sports", "Sports"],
      ["stories", "Stories"],
    ],
  );
  assert.ok(adapters.every((adapter) =>
    typeof adapter.validate === "function"
    && typeof adapter.prepare === "function"
    && typeof adapter.rollback === "function"));
});
