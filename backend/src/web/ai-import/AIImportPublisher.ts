import type { AIImportPackage } from "./AIImportTypes";
import { AIImportPublishError } from "./AIImportErrors";
export interface AIImportPublisherPort { publish(pkg:AIImportPackage):Promise<unknown>; releaseAssets?(pkg:AIImportPackage):void; }
export class AIImportPublisher {
  constructor(private readonly port:AIImportPublisherPort){}
  async publish(pkg:AIImportPackage){const result=await this.port.publish(pkg);if(!result)throw new AIImportPublishError("Le Publisher n’a retourné aucun résultat.");return result;}
  async publishAll(packages:readonly AIImportPackage[]){try{for(const pkg of packages)await this.publish(pkg);}finally{if(packages[0])this.port.releaseAssets?.(packages[0]);}}
}
