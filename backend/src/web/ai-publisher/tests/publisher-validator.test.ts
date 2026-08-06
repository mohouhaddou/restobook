import assert from "node:assert/strict";
import test from "node:test";
import fixtureJson from "../../../../../ai/examples/discover-package.json";
import type { ContentPackage } from "../../../../../ai/types";
import { AiPublisherValidator } from "../AiPublisherValidator";
import { PublishValidator } from "../PublishValidator";

const fixture = fixtureJson as ContentPackage;

test("AiPublisherValidator couvre Markdown, metadata, images, SEO, slug, catégorie et langue", () => {
  assert.equal(new AiPublisherValidator().validate(fixture).valid, true);
  const result = new AiPublisherValidator().validate({
    ...fixture,
    articleMarkdown: "",
    images: [],
    metadata: {
      ...fixture.metadata,
      title: "",
      slug: "Slug Incorrect",
      category: "",
    },
    seo: { ...fixture.seo, canonical: "invalide" },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("Markdown")));
  assert.ok(result.errors.some((error) => error.includes("image")));
  assert.ok(result.errors.some((error) => error.includes("slug")));
  assert.ok(result.errors.some((error) => error.includes("canonical")));
});
test("PublishValidator accepte les modules Kids spécialisés du registre",()=>{
  const validator=new PublishValidator();
  for(const module of ["nature","animals","space","science"] as const){
    assert.doesNotThrow(()=>validator.validate({id:`pkg-${module}`,validated:true,module,workspace:"/tmp",files:["cover.webp"],markdown:"# Test",manifest:{module},publisher:{},metadata:{title:"Test"}}));
  }
});
