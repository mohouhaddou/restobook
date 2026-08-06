export interface AIImportConfig { readonly tempRoot:string; readonly maxUploadBytes:number; readonly maxExtractedBytes:number; readonly maxFiles:number; readonly historyLimit:number; }
export const DEFAULT_AI_IMPORT_CONFIG:AIImportConfig={tempRoot:"/tmp",maxUploadBytes:50*1024*1024,maxExtractedBytes:250*1024*1024,maxFiles:100,historyLimit:500};
