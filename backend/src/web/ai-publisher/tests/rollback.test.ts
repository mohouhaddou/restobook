import assert from "node:assert/strict";
import test from "node:test";
import fixtureJson from "../../../../../ai/examples/discover-package.json";
import type { ContentPackage } from "../../../../../ai/types";
import { AiPublisherModule } from "../AiPublisherModule";
import { TestDatabase } from "./testDatabase";

const fixture = fixtureJson as ContentPackage;

test("une erreur de persistance déclenche un rollback complet", async () => {
  const database = new TestDatabase();
  database.failCreate = true;
  const module = new AiPublisherModule(database);
  const events: string[] = [];
  module.service.events.on((event) => events.push(event.type));

  const report = await module.service.publish(fixture);
  assert.equal(report.status, "ERROR");
  assert.equal(report.transactionStatus, "ROLLED_BACK");
  assert.equal(database.records.length, 0);
  assert.equal(database.rollbackCount, 1);
  assert.ok(events.includes("transaction:rollback"));
});

test("PublishRollback compense transaction et fichiers",async()=>{const removed:string[]=[];let rolled=false;const fs={mkdir:async()=>{},copy:async()=>{},remove:async(path:string)=>{removed.push(path);}};const{PublishRollback}=await import("../PublishRollback");await new PublishRollback(fs).execute({createArticle:async()=>({id:1}),commit:async()=>{},rollback:async()=>{rolled=true;}},["/uploads/a.webp"]);assert.equal(rolled,true);assert.deepEqual(removed,["/uploads/a.webp"]);});
