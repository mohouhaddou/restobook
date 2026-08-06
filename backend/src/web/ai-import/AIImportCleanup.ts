import { rm } from "node:fs/promises";
export class AIImportCleanup { async clean(workspace:string):Promise<void>{await rm(workspace,{recursive:true,force:true});} }
