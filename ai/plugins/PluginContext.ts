export interface PluginContext { readonly siteId:string; readonly configuration:Readonly<Record<string,unknown>>; readonly featureFlags:Readonly<Record<string,boolean>>; }
