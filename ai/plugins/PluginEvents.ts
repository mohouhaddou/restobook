export interface PluginEvent{readonly type:"loaded"|"activated"|"deactivated"|"failed";readonly pluginId:string;readonly date:string;}
export class PluginEvents{private readonly events:PluginEvent[]=[];emit(x:PluginEvent){this.events.push({...x});}list(){return this.events.map(x=>({...x}));}}
