import assert from"node:assert/strict";import test from"node:test";import{DashboardApi,DashboardService}from"../dashboard";
test("dashboard expose services sans React",async()=>{const api=new DashboardApi(new DashboardService(()=>({modules:1,plugins:0,editors:1,providers:1,publications:0}),async()=>({healthy:true,components:{}})));assert.equal((await api.getOverview()).health.healthy,true);});
