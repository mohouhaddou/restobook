import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AIImportConfig } from "./AIImportConfig";
import type { AIImportRecord, AIImportStatus } from "./AIImportTypes";
import { AIImportValidationError } from "./AIImportErrors";
import type { AIImportExtractor } from "./AIImportExtractor";
import type { AIImportValidator } from "./AIImportValidator";
import type { AIImportParser } from "./AIImportParser";
import type { AIImportPublisher } from "./AIImportPublisher";
import type { AIImportCleanup } from "./AIImportCleanup";
import type { AIImportQueue } from "./AIImportQueue";
import type { AIImportHistory } from "./AIImportHistory";
import type { AIImportEventBus } from "./AIImportEvents";
import type { AIImportLogger } from "./AIImportLogger";

export class AIImportService {
  private readonly records=new Map<string,AIImportRecord>();
  private readonly payloads=new Map<string,{buffer:Buffer;workspace:string}>();
  constructor(private readonly config:AIImportConfig,private readonly validator:AIImportValidator,private readonly extractor:AIImportExtractor,private readonly parser:AIImportParser,private readonly publisher:AIImportPublisher,private readonly cleanup:AIImportCleanup,private readonly queue:AIImportQueue,private readonly history:AIImportHistory,private readonly events:AIImportEventBus,private readonly logger:AIImportLogger,private readonly now=()=>new Date()){}
  async create(filename:string,buffer:Buffer):Promise<AIImportRecord>{
    const filenameErrors=this.validator.validateFilename(filename);if(filenameErrors.length)throw new AIImportValidationError(filenameErrors);
    if(!buffer.length||buffer.length>this.config.maxUploadBytes)throw new AIImportValidationError(["Taille du ZIP vide ou supérieure à la limite."]);
    if(buffer[0]!==0x50||buffer[1]!==0x4b)throw new AIImportValidationError(["Signature ZIP invalide."]);
    const id=randomUUID(),workspace=await mkdtemp(join(this.config.tempRoot,"import-"));const record:AIImportRecord={id,filename,status:"Waiting",progress:0,createdAt:this.now().toISOString(),logs:[],errors:[]};
    this.records.set(id,record);this.payloads.set(id,{buffer,workspace});this.queue.enqueue(record);await this.emit("import-created",record);void this.queue.drain(item=>this.process(item));return record;
  }
  list(){return [...this.records.values()];} get(id:string){return this.records.get(id);} historyList(){return this.history.list();} clearHistory(){this.history.clear();}
  errorReport(id:string){const record=this.records.get(id);return record?.errors.map((error,index)=>`${index+1}. ${error}`).join("\n")??"Import introuvable.";}
  private async process(record:AIImportRecord):Promise<void>{
    const payload=this.payloads.get(record.id);if(!payload)return;record.startedAt=this.now().toISOString();
    try{
      await this.step(record,"Uploading",8,"upload-progress");const zipPath=join(payload.workspace,"package.zip");await writeFile(zipPath,payload.buffer);this.payloads.set(record.id,{buffer:Buffer.alloc(0),workspace:payload.workspace});
      await this.step(record,"Uploaded",15,"upload-progress");await this.step(record,"Extracting",20,"extract-progress");
      const files=await this.extractor.extract(zipPath,payload.workspace,value=>{record.progress=20+Math.round(value*.2);void this.emit("extract-progress",record);});
      await this.step(record,"Validating",45,"validation-progress");const fileErrors=this.validator.validateFiles(files);if(fileErrors.length)throw new AIImportValidationError(fileErrors);
      const packages=await this.parser.parseAll(payload.workspace,files,record.filename);for(const pkg of packages){const packageErrors=await this.validator.validatePackage(pkg);if(packageErrors.length)throw new AIImportValidationError(packageErrors);}
      const first=packages[0];record.module=first.contentPackage.editor;record.title=first.contentPackage.metadata.title;await this.step(record,"Ready",65,"validation-progress");
      await this.step(record,"Publishing",72,"publish-progress");await this.publisher.publishAll(packages);await this.step(record,"Published",88,"publish-progress");
      await this.step(record,"Cleaning",94,"cleanup-progress");await this.cleanup.clean(payload.workspace);await this.step(record,"Completed",100,"import-success");
    }catch(error){
      record.errors.push(...(error instanceof AIImportValidationError?error.details:[error instanceof Error?error.message:String(error)]));this.logger.log(record,"error",record.errors.join(" | "));
      record.status="Failed";await this.emit("import-failed",record,{errors:record.errors});
      try{await this.cleanup.clean(payload.workspace);}catch(cleanupError){record.errors.push(`Nettoyage : ${cleanupError instanceof Error?cleanupError.message:String(cleanupError)}`);}
    }finally{
      this.payloads.delete(record.id);record.finishedAt=this.now().toISOString();record.duration=Date.parse(record.finishedAt)-Date.parse(record.startedAt??record.createdAt);
      this.history.add({date:record.finishedAt,filename:record.filename,module:record.module??"unknown",title:record.title??"Sans titre",duration:record.duration,result:record.status==="Completed"?"Completed":"Failed",errors:[...record.errors]});
    }
  }
  private async step(record:AIImportRecord,status:AIImportStatus,progress:number,event:"upload-progress"|"extract-progress"|"validation-progress"|"publish-progress"|"cleanup-progress"|"import-success"){record.status=status;record.progress=progress;this.logger.log(record,"info",`${status} (${progress}%)`);await this.emit(event,record);}
  private emit(name:Parameters<AIImportEventBus["emit"]>[0]["name"],record:AIImportRecord,payload?:Readonly<Record<string,unknown>>){return this.events.emit({name,importId:record.id,timestamp:this.now().toISOString(),record,payload});}
}
