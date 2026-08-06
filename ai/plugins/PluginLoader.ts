import type { BasePlugin } from "./BasePlugin"; import { PluginRegistry } from "./PluginRegistry";
export class PluginLoader { public constructor(private readonly registry:PluginRegistry){} load(plugin:BasePlugin){if(!plugin.manifest.id||!plugin.manifest.entryPoint)throw new Error("Manifest plugin invalide");this.registry.register(plugin);} }
