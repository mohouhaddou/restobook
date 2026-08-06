export class PluginPermissions { public allows(granted:readonly string[], required:readonly string[]):boolean{return required.every(x=>granted.includes(x));} }
