import assert from "node:assert/strict";
import test from "node:test";
import fixtureJson from "../../../../../ai/examples/discover-package.json";
import type { ContentPackage } from "../../../../../ai/types";
import { AiPublisherModule } from "../AiPublisherModule";
import { TestDatabase } from "./testDatabase";

const fixture = fixtureJson as ContentPackage;

test("un échec de commit ne laisse aucun enregistrement partiel", async () => {
  const database = new TestDatabase();
  database.failCommit = true;
  const report = await new AiPublisherModule(database).service.publish(fixture);
  assert.equal(report.status, "ERROR");
  assert.equal(report.transactionStatus, "ROLLED_BACK");
  assert.equal(database.records.length, 0);
  assert.equal(database.commitCount, 0);
  assert.equal(database.rollbackCount, 1);
});

test("PublishTransaction délègue commit et rollback",async()=>{let state="active";const{PublishTransaction}=await import("../PublishTransaction");const transaction=new PublishTransaction({createArticle:async()=>({id:1}),commit:async()=>{state="committed";},rollback:async()=>{state="rolled";}});await transaction.commit();assert.equal(state,"committed");});
