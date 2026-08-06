import { createWriteStream } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
interface TestArchive { pipe(output:NodeJS.WritableStream):void; on(event:"error",listener:(error:Error)=>void):void; append(value:string|Buffer,options:{name:string}):void; finalize():Promise<void>; }
const { ZipArchive }=createRequire(__filename)("archiver") as {ZipArchive:new()=>TestArchive};
export const validFiles:Readonly<Record<string,string|Buffer>>={"manifest.json":JSON.stringify({id:"pkg-test",module:"discover"}),"publisher.json":JSON.stringify({module:"discover"}),"metadata.json":JSON.stringify({title:"Océans lumineux",editor:"discover",language:"fr",slug:"oceans-lumineux"}),"article.md":"# Océans lumineux\n\nUn article complet.","cover.webp":Buffer.from("RIFFmockWEBP")};
export async function makeZip(files:Readonly<Record<string,string|Buffer>>=validFiles){const directory=await mkdtemp(join(tmpdir(),"ai-import-test-")),path=join(directory,"package.zip");await new Promise<void>((resolve,reject)=>{const output=createWriteStream(path),archive=new ZipArchive();output.on("close",resolve);archive.on("error",reject);archive.pipe(output);for(const[name,value]of Object.entries(files))archive.append(value,{name});void archive.finalize();});return{directory,path,buffer:await readFile(path)};}
