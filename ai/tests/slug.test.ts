import assert from "node:assert/strict";
import test from "node:test";
import { SlugGenerator } from "../integration";

test("SlugGenerator prend en charge FR, EN et AR", () => {
  const generator = new SlugGenerator();
  assert.equal(generator.generate("Découvrir l'été à Rabat", "fr"), "decouvrir-l-ete-a-rabat");
  assert.equal(generator.generate("The New Sports Guide", "en"), "the-new-sports-guide");
  assert.equal(generator.generate("دليل الأطفال الممتع", "ar"), "دليل-الأطفال-الممتع");
});
