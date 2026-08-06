export type PluginContribution = "editor"|"workflow"|"publisher"|"adapter"|"ai"|"category"|"statistics";
export interface PluginManifest { readonly id:string; readonly version:string; readonly contributions:readonly PluginContribution[]; readonly permissions:readonly string[]; readonly entryPoint:string; }
