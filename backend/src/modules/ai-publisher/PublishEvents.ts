export type PublishEventName="publish-started"|"publish-progress"|"image-imported"|"markdown-rewritten"|"seo-generated"|"article-created"|"publish-success"|"publish-failed"|"PUBLISH_COMPLETED";
export interface PublishEvent{readonly name:PublishEventName;readonly publishId:string;readonly timestamp:string;readonly progress:number;readonly payload?:Readonly<Record<string,unknown>>;}
export class PublishEventBus{constructor(private readonly sink?:(event:PublishEvent)=>void|Promise<void>){}async emit(event:PublishEvent){await this.sink?.(event);}}
