import assert from"node:assert/strict";import test from"node:test";import{MockProvider,ProviderFactory,ProviderRegistry}from"../providers";
test("provider choisi par configuration",async()=>{const r=new ProviderRegistry();r.register(new MockProvider());const p=new ProviderFactory(r).create("mock");assert.equal((await p.generate({prompt:"x",model:"m"})).provider,"mock");});
