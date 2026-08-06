import assert from"node:assert/strict";import test from"node:test";import{MODULE_IDS,isKnownModule,normalizeCategory,resolveModule,UnknownModuleError}from"../ModuleRegistry";

test("resolveModule connaît tous les modules éditoriaux",()=>{assert.deepEqual([...MODULE_IDS].sort(),["animals","discover","gaming","kids","nature","science","space","sports","stories","study"]);});

for(const id of MODULE_IDS){
  test(`resolveModule("${id}") retourne une définition cohérente`,()=>{
    const definition=resolveModule(id);
    assert.equal(definition.id,id);
    assert.ok(["article","portal","gaming","study"].includes(definition.modelKind));
  });
}

test("resolveModule normalise la casse et les espaces",()=>{assert.equal(resolveModule("  Stories  ").id,"stories");});

test("resolveModule accepte l'alias gaminghub pour gaming",()=>{assert.equal(resolveModule("gaminghub").id,"gaming");});

test("resolveModule lève UnknownModuleError avec le code UNKNOWN_MODULE pour un module inconnu",()=>{
  assert.throws(()=>resolveModule("recettes-maison"),(error:unknown)=>{
    assert.ok(error instanceof UnknownModuleError);
    assert.equal(error.code,"UNKNOWN_MODULE");
    assert.match(error.message,/UNKNOWN_MODULE/);
    return true;
  });
});

test("isKnownModule distingue module connu et inconnu",()=>{assert.equal(isKnownModule("kids"),true);assert.equal(isKnownModule("marketplace"),false);});

test("normalizeCategory force le content_type fixe de Stories quel que soit l'intrant",()=>{assert.equal(normalizeCategory("stories","recette"),"stories");assert.equal(normalizeCategory("stories",undefined),"stories");});

test("Stories publie dans le portail Kids (PortalContent), pas dans la table Article/Discover",()=>{const definition=resolveModule("stories");assert.equal(definition.modelKind,"portal");assert.equal(definition.portalName,"kids");});

test("Kids et Sports publient chacun dans leur propre portail physique",()=>{assert.equal(resolveModule("kids").portalName,"kids");assert.equal(resolveModule("sports").portalName,"sports");});

test("normalizeCategory retombe sur la catégorie par défaut de Discover si la catégorie est hors liste",()=>{assert.equal(normalizeCategory("discover","categorie-inexistante"),"actualite");assert.equal(normalizeCategory("discover","guide"),"guide");});

test("normalizeCategory retombe sur la catégorie par défaut de Gaming si la catégorie est hors liste",()=>{assert.equal(normalizeCategory("gaming","top"),"top");assert.equal(normalizeCategory("gaming","inconnue"),"actualite");});

test("normalizeCategory n'impose aucune liste fermée pour Kids/Sports",()=>{assert.equal(normalizeCategory("kids","aventure"),"aventure");assert.equal(normalizeCategory("sports",undefined),"article");});

test("Study publie dans son propre modelKind, pas dans PortalContent",()=>{const definition=resolveModule("study");assert.equal(definition.modelKind,"study");assert.equal(definition.portalName,undefined);});

test("normalizeCategory force le content_type fixe de Study quel que soit l'intrant",()=>{assert.equal(normalizeCategory("study","math"),"lesson");assert.equal(normalizeCategory("study",undefined),"lesson");});

test("resolveModule accepte les alias lesson/lessons/studies pour study",()=>{assert.equal(resolveModule("lesson").id,"study");assert.equal(resolveModule("lessons").id,"study");assert.equal(resolveModule("studies").id,"study");});
