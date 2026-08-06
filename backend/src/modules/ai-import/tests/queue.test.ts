import assert from"node:assert/strict";import test from"node:test";import{AIImportQueue}from"../AIImportQueue";
test("queue exécute séquentiellement",async()=>{const queue=new AIImportQueue(),order:string[]=[];queue.enqueue({id:"1"}as never);queue.enqueue({id:"2"}as never);await queue.drain(async record=>{order.push(record.id);});assert.deepEqual(order,["1","2"]);});
