import assert from "node:assert/strict";
import test from "node:test";
import fixtureJson from "../examples/discover-package.json";
import {
  AssetResolver,
  CategoryResolver,
  LanguageResolver,
  LinkResolver,
  SeoResolver,
  TagResolver,
} from "../integration";
import type { ContentPackage } from "../types";

const fixture = fixtureJson as ContentPackage;

test("les resolvers produisent des valeurs canoniques sans effets externes", () => {
  assert.equal(new LanguageResolver().resolve("FR-fr"), "fr");
  assert.deepEqual(new TagResolver().resolve([" Ville ", "ville", "Guide"]), ["guide", "ville"]);
  assert.equal(new CategoryResolver().resolve("gaming", "Jeux Action").product, "GamingHub");
  assert.equal(new LinkResolver().resolve("https://example.com/article").valid, true);
  assert.equal(new LinkResolver().resolve("/discover/article").valid, true);
  assert.equal(
    new AssetResolver().resolve("discover", fixture.images[0]).targetPath,
    "uploads/discover/discover-jardins-cover.webp",
  );
});

test("SeoResolver vérifie canonical, OpenGraph et Twitter Card", () => {
  const resolver = new SeoResolver();
  assert.equal(resolver.validate(fixture.seo).valid, true);
  assert.equal(resolver.validate({ ...fixture.seo, canonical: "relatif" }).valid, false);
});
