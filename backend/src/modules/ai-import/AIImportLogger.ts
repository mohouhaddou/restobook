import type { AIImportRecord } from "./AIImportTypes";
export class AIImportLogger { constructor(private readonly now=()=>new Date()){} log(record:AIImportRecord,level:"info"|"warning"|"error",message:string){record.logs.push({timestamp:this.now().toISOString(),level,message});} }
