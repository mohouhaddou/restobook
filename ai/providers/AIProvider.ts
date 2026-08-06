export interface AIRequest{readonly prompt:string;readonly model:string;readonly options?:Readonly<Record<string,unknown>>;}
export interface AIResponse{readonly provider:string;readonly model:string;readonly content:string;readonly latencyMs:number;}
export interface AIProvider{readonly id:string;generate(request:AIRequest):Promise<AIResponse>;health():Promise<boolean>;}
export abstract class ConfiguredAIProvider implements AIProvider{public abstract readonly id:string;public constructor(protected readonly handler?:(r:AIRequest)=>Promise<AIResponse>){}generate(r:AIRequest){if(!this.handler)throw new Error(`Provider ${this.id} non configuré`);return this.handler(r);}async health(){return Boolean(this.handler);}}
