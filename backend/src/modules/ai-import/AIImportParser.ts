import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AIImportPackage } from "./AIImportTypes";
import { AIImportValidationError } from "./AIImportErrors";
import { createDefaultImportRegistry, type ImportRegistry } from "./ImportRegistry";
import { resolveModule } from "../ai-publisher/ModuleRegistry";

export class AIImportParser {
  public constructor(private readonly registry:ImportRegistry=createDefaultImportRegistry()){}
  async parseAll(workspace:string,files:readonly string[],zipFilename=""):Promise<readonly AIImportPackage[]>{
    const localizedFiles=files.filter(file=>file.toLowerCase().endsWith("/content.json")&&file.indexOf("/")===file.lastIndexOf("/"));
    if(!localizedFiles.length)return[await this.parse(workspace,files,zipFilename)];
    const packages=await Promise.all(localizedFiles.sort().map(file=>this.parseLocalized(workspace,files,file,zipFilename)));
    const languages=new Set<string>();
    for(const pkg of packages){
      const language=String(pkg.contentPackage.metadata.language??pkg.contentPackage.language??"").trim();
      if(languages.has(language))throw new AIImportValidationError([`Plusieurs content.json déclarent la langue "${language}".`]);
      languages.add(language);
    }
    return packages;
  }
  async parse(workspace:string,files:readonly string[],zipFilename=""):Promise<AIImportPackage>{
    const root=join(workspace,"package");
    const readJson=async(name:string)=>{try{return JSON.parse(await readFile(join(root,name),"utf8")) as Record<string,unknown>;}catch(error){throw new AIImportValidationError([`${name} : JSON invalide (${error instanceof Error?error.message:String(error)}).`]);}};
    const readOptionalJson=async(name:string):Promise<Record<string,unknown>>=>files.includes(name)?readJson(name):{};
    const rawManifest=await readJson("manifest.json"),publisher=await readOptionalJson("publisher.json"),metadata=await readJson("metadata.json");
    const articleMarkdown=await readFile(join(root,"article.md"),"utf8");
    const rawModule=this.detectModule(rawManifest,metadata,zipFilename,publisher);
    const importer=this.registry.resolve(rawModule);
    const manifest={...rawManifest,module:importer.module};
    const context={manifest,publisher,metadata,articleMarkdown,workspace,files};
    const importerErrors=importer.validate(context);
    if(importerErrors.length)throw new AIImportValidationError(importerErrors);
    const contentPackage=importer.publish(context);
    return{manifest,publisher,metadata,articleMarkdown,contentPackage,workspace,files,social:importer.importSocial(context),assets:importer.importAssets(context)};
  }
  private async parseLocalized(workspace:string,files:readonly string[],contentFile:string,zipFilename:string):Promise<AIImportPackage>{
    const root=join(workspace,"package");
    const readJson=async(name:string)=>{try{return JSON.parse(await readFile(join(root,name),"utf8")) as Record<string,unknown>;}catch(error){throw new AIImportValidationError([`${name} : JSON invalide (${error instanceof Error?error.message:String(error)}).`]);}};
    const rawManifest=await readJson("manifest.json");
    const publisher=files.includes("publisher.json")?await readJson("publisher.json"):{};
    const rawContent=await readJson(contentFile);
    const folder=contentFile.slice(0,-"content.json".length),localMetadataFile=`${folder}metadata.json`,localArticleFile=`${folder}article.md`;
    const embeddedMetadata=rawContent.metadata&&typeof rawContent.metadata==="object"?rawContent.metadata:undefined;
    const metadata=(embeddedMetadata??(files.includes(localMetadataFile)?await readJson(localMetadataFile):rawContent)) as Record<string,unknown>;
    const language=String(metadata.language??rawContent.language??"").trim();
    if(!language)throw new AIImportValidationError([`${contentFile} : language est obligatoire.`]);
    const embeddedArticle=rawContent.articleMarkdown??rawContent.markdown??(typeof rawContent.content==="string"?rawContent.content:undefined);
    const articleMarkdown=typeof embeddedArticle==="string"?embeddedArticle:(files.includes(localArticleFile)?await readFile(join(root,localArticleFile),"utf8"):"");
    const rawModule=this.detectModule(rawManifest,{...metadata,editor:rawContent.editor},zipFilename,publisher);
    const importer=this.registry.resolve(rawModule);
    const manifest={...rawManifest,module:importer.module};
    const sharedFiles=files.filter(file=>file!=="manifest.json"&&file!=="publisher.json"&&!(file.toLowerCase().endsWith("/content.json")&&file.indexOf("/")===file.lastIndexOf("/")));
    const context={manifest,publisher,metadata:{...metadata,language},articleMarkdown,workspace,files:sharedFiles};
    const importerErrors=importer.validate(context);if(importerErrors.length)throw new AIImportValidationError(importerErrors);
    const completeContent=embeddedMetadata!==undefined&&typeof rawContent.articleMarkdown==="string";
    const contentPackage=completeContent?{...rawContent,editor:importer.module,language,metadata:{...metadata,language}} as unknown as AIImportPackage["contentPackage"]:importer.publish(context);
    return{manifest,publisher,metadata:context.metadata,articleMarkdown,contentPackage,workspace,files:sharedFiles,social:importer.importSocial(context),assets:importer.importAssets(context)};
  }
  private detectModule(
    manifest:Readonly<Record<string,unknown>>,
    metadata:Readonly<Record<string,unknown>>,
    zipFilename:string,
    publisher:Readonly<Record<string,unknown>>,
  ):string{
    if(typeof manifest.module==="string"&&manifest.module.trim())return manifest.module;
    if(typeof manifest.type==="string"&&manifest.type.trim())return manifest.type;

    const filename=zipFilename.toLowerCase().replace(/\.zip$/,"");
    const filenameMatch=filename.match(/(?:^|[-_])(stories?|animals?|nature|space|science|stud(?:y|ies))(?:[-_]|$)/);
    if(filenameMatch)return filenameMatch[1];

    for(const candidate of [metadata.category,metadata.content_type,metadata.module,metadata.editor,publisher.module]){
      if(typeof candidate!=="string"||!candidate.trim())continue;
      try{return resolveModule(candidate).id;}catch{/* essayer le prochain indice rétrocompatible */}
    }
    return "";
  }
}
