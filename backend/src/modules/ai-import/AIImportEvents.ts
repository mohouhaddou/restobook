import type { AIImportEventName, AIImportRecord } from "./AIImportTypes";
export interface AIImportEvent { readonly name:AIImportEventName; readonly importId:string; readonly timestamp:string; readonly record:Readonly<AIImportRecord>; readonly payload?:Readonly<Record<string,unknown>>; }
export type AIImportEventListener=(event:AIImportEvent)=>void|Promise<void>;
export class AIImportEventBus { private readonly listeners=new Set<AIImportEventListener>(); on(listener:AIImportEventListener){this.listeners.add(listener);return()=>this.listeners.delete(listener);} async emit(event:AIImportEvent){await Promise.all([...this.listeners].map(listener=>listener(event)));} }
