import type{PublishModule}from"./PublishConfig";
export interface DuplicateQuery{readonly slug:string;readonly title:string;readonly checksum:string;readonly markdown:string;readonly language?:string;}
export interface ArticleRecord{readonly module:PublishModule;readonly slug:string;readonly title:string;readonly language?:string;readonly excerpt:string;readonly markdown:string;readonly category:string;readonly tags:readonly string[];readonly seo:Readonly<Record<string,unknown>>;readonly featuredImage:string;readonly gallery:readonly string[];readonly checksum:string;readonly wordCount:number;readonly readingTime:number;}
export interface DatabaseTransaction{createArticle(record:ArticleRecord):Promise<{readonly id:string|number}>;commit():Promise<void>;rollback():Promise<void>;}
export interface PublishRepository{exists(module:PublishModule,query:DuplicateQuery):Promise<boolean>;begin():Promise<DatabaseTransaction>;}
export class PublishTransaction{constructor(public readonly transaction:DatabaseTransaction){}commit(){return this.transaction.commit();}rollback(){return this.transaction.rollback();}}
