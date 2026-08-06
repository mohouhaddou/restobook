import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import unzipper from "unzipper";
import type { AIImportConfig } from "./AIImportConfig";
import { AIImportExtractionError } from "./AIImportErrors";

/** Extraction streamée avec défense Zip Slip et limites anti zip-bomb. */
export class AIImportExtractor {
  public constructor(private readonly config:AIImportConfig){}
  public async extract(zipPath:string,workspace:string,onProgress?:(value:number)=>void):Promise<readonly string[]>{
    const directory=join(workspace,"package");await mkdir(directory,{recursive:true});
    const archive=await unzipper.Open.file(zipPath);
    if(archive.files.length>this.config.maxFiles)throw new AIImportExtractionError("Le ZIP contient trop de fichiers.");
    const files:string[]=[];let extracted=0;let processed=0;
    for(const entry of archive.files){
      if(entry.type==="Directory")continue;
      const relative=normalize(entry.path);
      if(isAbsolute(relative)||relative===".."||relative.startsWith(`..${sep}`))throw new AIImportExtractionError(`Chemin interdit dans le ZIP : ${entry.path}`);
      extracted+=entry.uncompressedSize;
      if(extracted>this.config.maxExtractedBytes)throw new AIImportExtractionError("Taille décompressée maximale dépassée.");
      await mkdir(dirname(join(directory,relative)),{recursive:true});
      await pipeline(entry.stream(),createWriteStream(join(directory,relative),{flags:"wx"}));
      files.push(relative);processed++;onProgress?.(Math.round(processed/Math.max(archive.files.length,1)*100));
    }
    return files;
  }
}
