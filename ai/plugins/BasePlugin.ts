import type { PluginContext } from "./PluginContext"; import type { PluginManifest } from "./PluginManifest";
export abstract class BasePlugin { public constructor(public readonly manifest:PluginManifest){} public abstract activate(context:PluginContext):Promise<void>; public abstract deactivate():Promise<void>; }
