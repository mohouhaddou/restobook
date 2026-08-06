import assert from "node:assert/strict";
import test from "node:test";
import fixtureJson from "../examples/discover-package.json";
import {
  ContentImporter,
  ImageImporter,
  MarkdownImporter,
  MetadataImporter,
} from "../integration";
import type { ContentPackage } from "../types";

const fixture = fixtureJson as ContentPackage;

test("ContentImporter prépare le package sans muter la source", () => {
  const source = structuredClone(fixture);
  const result = new ContentImporter().prepare(source);
  assert.equal(result.valid, true);
  assert.equal(result.package.articleMarkdown.endsWith("\n"), true);
  assert.equal(result.package.sections.length, 1);
  assert.equal(result.package.sections[0].imageReference, "discover-cover");
  assert.deepEqual(source, fixture);
});

test("les importers spécialisés détectent les incohérences", () => {
  assert.equal(new MarkdownImporter().prepare("[cassé](notaurl)").valid, false);
  assert.equal(new ImageImporter().prepare({
    ...fixture,
    sections: [{ ...fixture.sections[0], imageReference: "absente" }],
  }).valid, false);
  assert.equal(new MetadataImporter().prepare({
    ...fixture,
    metadata: { ...fixture.metadata, title: "" },
  }).valid, false);
});
