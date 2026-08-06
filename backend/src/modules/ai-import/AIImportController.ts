import type { AIImportService } from "./AIImportService";
export class AIImportController {
  constructor(private readonly service:AIImportService){}
  upload(filename:string,buffer:Buffer){return this.service.create(filename,buffer);}
  list(){return this.service.list();} history(){return this.service.historyList();} clearHistory(){this.service.clearHistory();}
  report(id:string){return this.service.errorReport(id);}
}
