import type{AIModelManifest}from"./ModelCapabilities";export class ModelHealth{check(m:AIModelManifest){return{modelId:m.id,healthy:m.enabled&&m.capabilities.context>0};}}
