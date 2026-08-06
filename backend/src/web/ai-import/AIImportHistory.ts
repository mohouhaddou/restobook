import type { AIImportHistoryEntry } from "./AIImportTypes";
export class AIImportHistory { private entries:AIImportHistoryEntry[]=[]; constructor(private readonly limit=500){} add(entry:AIImportHistoryEntry){this.entries=[entry,...this.entries].slice(0,this.limit);} list(){return [...this.entries];} clear(){this.entries=[];} }
