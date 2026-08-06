import type { AIImportRecord } from "./AIImportTypes";
export class AIImportQueue {
  private readonly pending:AIImportRecord[]=[]; private processing=false;
  enqueue(record:AIImportRecord){this.pending.push(record);} list(){return [...this.pending];}
  async drain(handler:(record:AIImportRecord)=>Promise<void>){if(this.processing)return;this.processing=true;try{while(this.pending.length){const record=this.pending[0]!;await handler(record);this.pending.shift();}}finally{this.processing=false;}}
}
