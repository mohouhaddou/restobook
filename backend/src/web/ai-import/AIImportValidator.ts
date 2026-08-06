import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { AIImportPackage } from "./AIImportTypes";
import { isKnownModule } from "../ai-publisher/ModuleRegistry";

const REQUIRED=["manifest.json","metadata.json","article.md","cover.webp"] as const;
export class AIImportValidator {
  validateFilename(filename:string){return filename.toLowerCase().endsWith(".zip")?[]:["Le fichier doit avoir l’extension .zip."];}
  validateFiles(files:readonly string[]):string[]{const errors:string[]=[];const localized=files.some(file=>file.toLowerCase().endsWith("/content.json")&&file.indexOf("/")===file.lastIndexOf("/"));for(const file of localized?["manifest.json"]:REQUIRED)if(!files.includes(file))errors.push(`Fichier obligatoire manquant : ${file}`);for(const file of files){const ext=extname(file).toLowerCase();if(file.startsWith("image")&&ext!==".webp")errors.push(`Image invalide : ${file} doit être WebP.`);}return errors;}
  async validatePackage(pkg:AIImportPackage):Promise<string[]>{const errors:string[]=[];const metadata=pkg.metadata;
    if(typeof metadata.title!=="string"||!metadata.title.trim())errors.push("metadata/content.json : title est obligatoire.");
    // manifest.module fait autorité, comme dans AIImportParser ; publisher.json/metadata.json ne sont
    // que des replis. Un module inconnu doit stopper la publication (UNKNOWN_MODULE), jamais retomber
    // silencieusement sur Discover.
    const declaredModule=String(pkg.manifest.module??pkg.publisher.module??metadata.editor??"");
    if(!isKnownModule(declaredModule))errors.push(`UNKNOWN_MODULE: le module "${declaredModule||"(absent)"}" est invalide ou absent.`);
    if(!pkg.articleMarkdown.trim())errors.push("articleMarkdown/article.md est vide.");
    for(const file of pkg.files.filter(name=>name.endsWith(".webp"))){const bytes=await readFile(join(pkg.workspace,"package",file));if(bytes.length<12||bytes.subarray(0,4).toString()!=="RIFF"||bytes.subarray(8,12).toString()!=="WEBP")errors.push(`Image WebP corrompue : ${file}.`);}
    return errors;
  }
}
