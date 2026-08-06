import assert from"node:assert/strict";import test from"node:test";import{mkdtemp,rm}from"node:fs/promises";import{join}from"node:path";import{tmpdir}from"node:os";import{AIImportParser}from"../AIImportParser";import{AIImportExtractor}from"../AIImportExtractor";import{AIImportValidationError}from"../AIImportErrors";import{DEFAULT_AI_IMPORT_CONFIG}from"../AIImportConfig";import{makeZip}from"./fixtures";

async function parseModule(files:Readonly<Record<string,string|Buffer>>,zipFilename="package.zip"){
  const zip=await makeZip(files),workspace=await mkdtemp(join(tmpdir(),"parser-"));
  try{
    const extracted=await new AIImportExtractor(DEFAULT_AI_IMPORT_CONFIG).extract(zip.path,workspace);
    return await new AIImportParser().parse(workspace,extracted,zipFilename);
  }finally{
    await rm(zip.directory,{recursive:true,force:true});await rm(workspace,{recursive:true,force:true});
  }
}

function packageFor(module:string,options:{publisherModule?:string}={}){
  return{
    "manifest.json":JSON.stringify({id:`pkg-${module}`,module}),
    // publisher.json reproduit un gabarit générique partagé entre projets ChatGPT : il ne
    // doit jamais faire autorité sur le module déclaré par manifest.json.
    "publisher.json":JSON.stringify({module:options.publisherModule??"discover"}),
    "metadata.json":JSON.stringify({title:`Article ${module}`,editor:"discover",language:"fr",slug:`article-${module}`}),
    "article.md":`# Article ${module}\n\nContenu.`,
    "cover.webp":Buffer.from("RIFFmockWEBP"),
  };
}

for(const module of["discover","stories","kids","sports","gaming","nature","animals","space","science"]){
  test(`AIImportParser publie "${module}" d'après manifest.module même si publisher.json dit "discover"`,async()=>{
    const pkg=await parseModule(packageFor(module,{publisherModule:"discover"}));
    assert.equal(pkg.contentPackage.editor,module,`Le module attendu est "${module}", pas la valeur de publisher.json ni un fallback codé en dur.`);
    assert.equal(pkg.contentPackage.seo.canonical,`https://ifilino.com/${module}/article-${module}`);
  });
}

test("AIImportParser accepte l'alias historique gaminghub pour gaming",async()=>{
  const pkg=await parseModule(packageFor("gaminghub",{publisherModule:"gaminghub"}));
  assert.equal(pkg.contentPackage.editor,"gaming");
});

test("AIImportParser rejette un module inconnu avec UNKNOWN_MODULE plutôt qu'un fallback discover",async()=>{
  await assert.rejects(
    ()=>parseModule(packageFor("recettes-maison")),
    (error:unknown)=>{
      assert.ok(error instanceof AIImportValidationError);
      assert.ok(error.details.some(detail=>detail.startsWith("UNKNOWN_MODULE")));
      return true;
    },
  );
});

test("AIImportParser rejette un manifest sans module ni repli exploitable",async()=>{
  const files=packageFor("discover");
  const withoutModule={...files,"manifest.json":JSON.stringify({id:"pkg-none"}),"metadata.json":JSON.stringify({title:"Sans module",language:"fr",slug:"sans-module"})};
  await assert.rejects(
    ()=>parseModule({...withoutModule,"publisher.json":JSON.stringify({})}),
    (error:unknown)=>{
      assert.ok(error instanceof AIImportValidationError);
      assert.ok(error.details.some(detail=>detail.startsWith("UNKNOWN_MODULE")));
      return true;
    },
  );
});
test("AIImportParser accepte les anciens manifestes qui déclarent seulement type",async()=>{
  for(const [type,module] of [["ifilino-story-publication","stories"],["ifilino-nature-publication","nature"],["ifilino-animals-publication","animals"],["ifilino-space-publication","space"],["ifilino-science-publication","science"]] as const){
    const files=packageFor(module);
    const pkg=await parseModule({...files,"manifest.json":JSON.stringify({id:`legacy-${module}`,type})});
    assert.equal(pkg.manifest.module,module);assert.equal(pkg.contentPackage.editor,module);
  }
});

test("AIImportParser infère le module depuis le nom original du ZIP",async()=>{
  const files=packageFor("animals");
  const pkg=await parseModule({...files,"manifest.json":JSON.stringify({id:"legacy-filename"}),"metadata.json":JSON.stringify({title:"Éléphant",language:"fr"}),"publisher.json":JSON.stringify({})},"ifilino-animals-elephant.zip");
  assert.equal(pkg.manifest.module,"animals");
});

test("AIImportParser utilise category puis content_type dans metadata.json en dernier repli",async()=>{
  for(const [field,value,module] of [["category","nature","nature"],["content_type","science","science"]] as const){
    const files=packageFor(module);
    const pkg=await parseModule({...files,"manifest.json":JSON.stringify({id:`legacy-metadata-`}),"metadata.json":JSON.stringify({title:"Legacy",language:"fr",[field]:value}),"publisher.json":JSON.stringify({})});
    assert.equal(pkg.manifest.module,module);
  }
});

test("manifest.module reste prioritaire sur type, nom ZIP et metadata",async()=>{
  const files=packageFor("space");
  const pkg=await parseModule({...files,"manifest.json":JSON.stringify({module:"space",type:"ifilino-animals-publication"}),"metadata.json":JSON.stringify({title:"Priorité",category:"nature",language:"fr"})},"ifilino-science-test.zip");
  assert.equal(pkg.manifest.module,"space");
});


test("AIImportParser détecte toutes les langues depuis content.json sans utiliser le nom du dossier",async()=>{
  const base={editor:"kids",category:"story",articleMarkdown:"# Localized",metadata:{title:"Localized",slug:"same-story",excerpt:"Localized",description:"Localized",keywords:[],tags:[],author:{name:"Test",type:"ai-editor"},category:"story",readingTime:1,difficulty:"beginner",sources:[],license:{name:"Test"}},images:[],seo:{title:"Localized",description:"Localized",canonical:"https://ifilino.test",robots:"index,follow",openGraph:{title:"Localized",description:"Localized",type:"article",siteName:"iFilino"},twitter:{card:"summary",title:"Localized",description:"Localized"}},workflow:{editor:"kids",version:"1",steps:[]},version:"1",status:"approved"};
  const files={"manifest.json":JSON.stringify({id:"multi",module:"kids"}),"locale-one/content.json":JSON.stringify({...base,language:"de",metadata:{...base.metadata,language:"de",title:"Deutsch"}}),"locale-two/content.json":JSON.stringify({...base,language:"pt-BR",metadata:{...base.metadata,language:"pt-BR",title:"Português"}}),"images/cover.webp":Buffer.from("RIFFmockWEBP")};
  const zip=await makeZip(files),workspace=await mkdtemp(join(tmpdir(),"parser-multi-"));
  try{const extracted=await new AIImportExtractor(DEFAULT_AI_IMPORT_CONFIG).extract(zip.path,workspace);const packages=await new AIImportParser().parseAll(workspace,extracted);assert.deepEqual(packages.map(pkg=>pkg.contentPackage.metadata.language),["de","pt-BR"]);assert.ok(packages.every(pkg=>pkg.files.includes("images/cover.webp")));assert.ok(packages.every(pkg=>!pkg.files.some(file=>file.endsWith("content.json"))));}finally{await rm(zip.directory,{recursive:true,force:true});await rm(workspace,{recursive:true,force:true});}
});


test("AIImportParser réutilise metadata.json et article.md dans chaque dossier localisé",async()=>{
  const content=(language:string)=>JSON.stringify({language});
  const files={"manifest.json":JSON.stringify({id:"multi-legacy",module:"kids"}),"en/content.json":content("en"),"en/metadata.json":JSON.stringify({title:"English title",slug:"same",language:"en"}),"en/article.md":"# English body","fr/content.json":content("fr"),"fr/metadata.json":JSON.stringify({title:"Titre français",slug:"same",language:"fr"}),"fr/article.md":"# Corps français","images/cover.webp":Buffer.from("RIFFmockWEBP")};
  const zip=await makeZip(files),workspace=await mkdtemp(join(tmpdir(),"parser-multi-legacy-"));
  try{const extracted=await new AIImportExtractor(DEFAULT_AI_IMPORT_CONFIG).extract(zip.path,workspace);const packages=await new AIImportParser().parseAll(workspace,extracted);assert.deepEqual(packages.map(pkg=>pkg.contentPackage.metadata.title),["English title","Titre français"]);assert.deepEqual(packages.map(pkg=>pkg.articleMarkdown),["# English body","# Corps français"]);}finally{await rm(zip.directory,{recursive:true,force:true});await rm(workspace,{recursive:true,force:true});}
});
