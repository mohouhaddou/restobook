import assert from "node:assert/strict";
import test from "node:test";
import fixtureJson from "../examples/discover-package.json";
import { DiscoverAdapter } from "../adapters";
import { IntegrationEngine, IntegrationValidationError } from "../integration";
import type { ContentPackage } from "../types";

const fixture = fixtureJson as ContentPackage;
const clock = () => new Date("2026-07-23T15:00:00.000Z");

test("IntegrationEngine enregistre, prépare et annule un artefact", () => {
  const engine = new IntegrationEngine({
    now: clock,
    idGenerator: () => "integration-1",
  });
  engine.registerAdapter(new DiscoverAdapter());

  assert.equal(engine.getAdapter("discover").targetProduct, "Discover");
  assert.deepEqual(engine.listAdapters().map((adapter) => adapter.id), ["discover"]);
  assert.equal(engine.validate(fixture).valid, true);

  const receipt = engine.import(fixture);
  assert.equal(receipt.status, "PREPARED");
  assert.equal(receipt.artifact.packageId, fixture.id);
  assert.equal(receipt.artifact.assets[0].targetPath, "uploads/discover/discover-jardins-cover.webp");

  const rolledBack = engine.rollback(receipt.id);
  assert.equal(rolledBack.status, "ROLLED_BACK");
  assert.equal(rolledBack.rolledBackAt, "2026-07-23T15:00:00.000Z");
});

test("IntegrationEngine refuse un package incompatible", () => {
  const engine = new IntegrationEngine({ idGenerator: () => "invalid-1" });
  engine.registerAdapter(new DiscoverAdapter());
  assert.throws(
    () => engine.import({ ...fixture, articleMarkdown: "" }),
    IntegrationValidationError,
  );
});
