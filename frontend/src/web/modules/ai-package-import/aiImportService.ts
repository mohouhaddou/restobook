import { API } from "../../../shared/services/api";
import type { ImportHistory, ImportRecord } from "./types";
const auth=(token:string)=>({Authorization:`Bearer ${token}`});
export const aiImportService={
  list:async(token:string):Promise<ImportRecord[]>=>{const response=await fetch(API("/superadmin/ai-import"),{headers:auth(token)});if(!response.ok)throw new Error("Impossible de charger les imports.");return(await response.json()).imports;},
  history:async(token:string):Promise<ImportHistory[]>=>{const response=await fetch(API("/superadmin/ai-import/history"),{headers:auth(token)});if(!response.ok)throw new Error("Impossible de charger l’historique.");return(await response.json()).history;},
  clearHistory:async(token:string)=>{const response=await fetch(API("/superadmin/ai-import/history"),{method:"DELETE",headers:auth(token)});if(!response.ok)throw new Error("La suppression a échoué.");},
  downloadReport:async(id:string,token:string)=>{
    const response=await fetch(API(`/superadmin/ai-import/${id}/report`),{headers:auth(token)});
    if(!response.ok)throw new Error("Le rapport n’est plus disponible.");
    const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`ai-import-${id}.json`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  },
  upload:(file:File,token:string,onProgress:(value:number)=>void)=>new Promise<ImportRecord>((resolve,reject)=>{const xhr=new XMLHttpRequest(),data=new FormData();data.append("package",file);xhr.open("POST",API("/superadmin/ai-import"));xhr.setRequestHeader("Authorization",`Bearer ${token}`);xhr.upload.onprogress=event=>event.lengthComputable&&onProgress(Math.round(event.loaded/event.total*100));xhr.onerror=()=>reject(new Error("Connexion interrompue."));xhr.onload=()=>{let payload:unknown;try{payload=JSON.parse(xhr.responseText);}catch{payload={};}if(xhr.status>=200&&xhr.status<300)resolve(payload as ImportRecord);else reject(new Error(String((payload as{error?:string}).error??"Import refusé.")));};xhr.send(data);})
};
