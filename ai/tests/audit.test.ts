import assert from"node:assert/strict";import test from"node:test";import{AuditService}from"../audit";
test("audit historise chaque action",()=>{const a=new AuditService();a.record("publish","agent","article");assert.equal(a.report().total,1);});
