export interface PublishLog{readonly timestamp:string;readonly level:"info"|"warning"|"error";readonly message:string;}
export class PublishLogger{private readonly entries:PublishLog[]=[];log(level:PublishLog["level"],message:string){this.entries.push({timestamp:new Date().toISOString(),level,message});}list(){return [...this.entries];}}
