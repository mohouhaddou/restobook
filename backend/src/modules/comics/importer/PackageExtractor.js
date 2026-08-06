'use strict';
const AdmZip=require('adm-zip');
class PackageExtractor{
 static inspect(file){let zip;try{zip=new AdmZip(file)}catch{const e=new Error('ZIP integrity check failed.');e.status=422;throw e}const entries=zip.getEntries().filter(x=>!x.isDirectory);const byName=new Map(entries.map(x=>[x.entryName.replace(/^\.\//,'').toLowerCase(),x]));const manifestEntry=entries.find(x=>/(^|\/)manifest\.json$/i.test(x.entryName));if(!manifestEntry){const e=new Error('Missing manifest.json.');e.status=422;throw e}let manifest;try{manifest=JSON.parse(manifestEntry.getData().toString('utf8'))}catch{const e=new Error('Invalid manifest.json.');e.status=422;throw e}return{zip,entries,byName,manifest}}
 static images(entries){return entries.filter(x=>/\.(png|jpe?g|webp)$/i.test(x.entryName))}
}
module.exports=PackageExtractor;