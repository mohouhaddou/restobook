import assert from "node:assert/strict";
import test from "node:test";
import { AiPublisherRepository, type AiPublisherRecord } from "../AiPublisherRepository";
import { TestDatabase } from "./testDatabase";

const record: AiPublisherRecord = {
  packageId: "package-1",
  editor: "discover",
  target: "discover_articles",
  slug: "article",
  category: "guide",
  language: "fr",
  title: "Article",
  markdown: "# Article",
  metadata: {},
  seo: {},
  images: [],
};

test("AiPublisherRepository encapsule sauvegarde et commit", async () => {
  const database = new TestDatabase();
  const repository = new AiPublisherRepository(database);
  const transaction = await repository.createTransaction();
  const persisted = await transaction.save(record);
  assert.equal(persisted.id, "record-1");
  assert.equal(database.records.length, 0);
  await transaction.commit();
  assert.equal(database.records.length, 1);
});

test("AiPublisherRepository rend le rollback idempotent", async () => {
  const database = new TestDatabase();
  const transaction = await new AiPublisherRepository(database).createTransaction();
  await transaction.save(record);
  await transaction.rollback();
  await transaction.rollback();
  assert.equal(database.records.length, 0);
  assert.equal(database.rollbackCount, 1);
});
