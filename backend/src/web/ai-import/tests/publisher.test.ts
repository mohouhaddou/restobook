import assert from"node:assert/strict";import test from"node:test";import{AIImportPublisher}from"../AIImportPublisher";
test("publisher appelle exclusivement le port injecté",async()=>{let called=0;const publisher=new AIImportPublisher({async publish(){called++;return{id:"published"};}});assert.deepEqual(await publisher.publish({}as never),{id:"published"});assert.equal(called,1);});
