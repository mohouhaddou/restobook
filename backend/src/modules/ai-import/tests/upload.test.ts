import assert from"node:assert/strict";import test from"node:test";import{AIImportValidator}from"../AIImportValidator";
test("upload accepte seulement ZIP",()=>{const validator=new AIImportValidator();assert.deepEqual(validator.validateFilename("package.zip"),[]);assert.equal(validator.validateFilename("package.rar").length,1);});
