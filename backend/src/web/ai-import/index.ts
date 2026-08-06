import express from "express";
import multer from "multer";
import { DEFAULT_AI_IMPORT_CONFIG, type AIImportConfig } from "./AIImportConfig";
import { AIImportCleanup } from "./AIImportCleanup";
import { AIImportController } from "./AIImportController";
import { AIImportEventBus } from "./AIImportEvents";
import { AIImportExtractor } from "./AIImportExtractor";
import { AIImportHistory } from "./AIImportHistory";
import { AIImportLogger } from "./AIImportLogger";
import { AIImportParser } from "./AIImportParser";
import { AIImportPublisher, type AIImportPublisherPort } from "./AIImportPublisher";
import { AIImportQueue } from "./AIImportQueue";
import { AIImportService } from "./AIImportService";
import { AIImportValidator } from "./AIImportValidator";
import { AIImportError } from "./AIImportErrors";

export interface AIImportModuleOptions { readonly config?:AIImportConfig; readonly publisher:AIImportPublisherPort; readonly eventEmitter?:(event:string,payload:unknown)=>void; }

export function createAIImportModule(options:AIImportModuleOptions){
  const config=options.config??DEFAULT_AI_IMPORT_CONFIG;const events=new AIImportEventBus();
  if(options.eventEmitter)events.on(event=>options.eventEmitter?.(event.name,event));
  const history=new AIImportHistory(config.historyLimit),queue=new AIImportQueue();
  const service=new AIImportService(config,new AIImportValidator(),new AIImportExtractor(config),new AIImportParser(),new AIImportPublisher(options.publisher),new AIImportCleanup(),queue,history,events,new AIImportLogger());
  return{controller:new AIImportController(service),service,events,history,queue};
}

export function createAIImportRouter(options:AIImportModuleOptions){
  const router=express.Router();const module=createAIImportModule(options);
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:(options.config??DEFAULT_AI_IMPORT_CONFIG).maxUploadBytes,files:1},fileFilter:(_req,file,callback)=>callback(null,file.originalname.toLowerCase().endsWith(".zip"))});
  router.post("/",upload.single("package"),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:"Un fichier ZIP est obligatoire."});const record=await module.controller.upload(req.file.originalname,req.file.buffer);return res.status(202).json(record);}catch(error){const status=error instanceof AIImportError?422:500;return res.status(status).json({error:error instanceof Error?error.message:String(error),details:error instanceof AIImportError?error.details:[]});}});
  router.get("/",(_req,res)=>res.json({imports:module.controller.list()}));
  router.get("/history",(_req,res)=>res.json({history:module.controller.history()}));
  router.delete("/history",(_req,res)=>{module.controller.clearHistory();res.status(204).end();});
  router.get("/:id/report",(req,res)=>{res.setHeader("Content-Type","text/plain; charset=utf-8");res.setHeader("Content-Disposition",`attachment; filename=\"ai-import-${req.params.id}-errors.txt\"`);res.send(module.controller.report(req.params.id));});
  return router;
}

export * from "./AIImportCleanup";export * from "./AIImportConfig";export * from "./AIImportController";export * from "./AIImportErrors";export * from "./AIImportEvents";export * from "./AIImportExtractor";export * from "./AIImportHistory";export * from "./AIImportLogger";export * from "./AIImportParser";export * from "./AIImportPublisher";export * from "./AIImportQueue";export * from "./AIImportService";export * from "./AIImportTypes";export * from "./AIImportValidator";
export * from "./ImportRegistry";
