import assert from "node:assert/strict";
import test from "node:test";
import fixtureJson from "../../../../../ai/examples/discover-package.json";
import type { ContentPackage } from "../../../../../ai/types";
import { AiPublisherModule } from "../AiPublisherModule";
import { TestDatabase } from "./testDatabase";

const fixture = fixtureJson as ContentPackage;

test("AiPublisherService publie un package valide atomiquement", async () => {
  const database = new TestDatabase();
  const module = new AiPublisherModule(database, {
    idGenerator: () => "operation-1",
    now: () => new Date("2026-07-23T16:00:00.000Z"),
  });
  const report = await module.service.publish(fixture);

  assert.equal(report.status, "SUCCESS");
  assert.equal(report.transactionStatus, "COMMITTED");
  assert.equal(report.result?.target, "discover_articles");
  assert.equal(database.records.length, 1);
  assert.equal(database.records[0].packageId, fixture.id);
});

test("AiPublisherService rejette avant transaction un package invalide", async () => {
  const database = new TestDatabase();
  const module = new AiPublisherModule(database);
  const report = await module.service.publish({ ...fixture, articleMarkdown: "" });
  assert.equal(report.status, "ERROR");
  assert.equal(report.transactionStatus, "NOT_STARTED");
  assert.equal(database.beginCount, 0);
});
