import assert from"node:assert/strict";import test from"node:test";import{AIOperatingSystem}from"../os";
test("AI OS démarre sans composants codés en dur",async()=>{const os=new AIOperatingSystem({version:"2.0.0",siteIds:["site"],modules:[],plugins:[],providers:[],editors:[],featureFlags:{}});await os.start();assert.equal(os.status,"READY");await os.stop();assert.equal(os.status,"STOPPED");});
