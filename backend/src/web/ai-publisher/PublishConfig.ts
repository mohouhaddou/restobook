export const PUBLISH_MODULES=["discover","sports","kids","stories","gaming","marketplace","nature","animals","space","science","study"] as const;
export type PublishModule=(typeof PUBLISH_MODULES)[number];
export interface PublishConfig{readonly uploadsRoot:string;readonly publicUploadsRoot:string;readonly historyLimit:number;}
export const DEFAULT_PUBLISH_CONFIG:PublishConfig={uploadsRoot:"uploads",publicUploadsRoot:"/uploads",historyLimit:500};
