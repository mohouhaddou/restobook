import assert from "node:assert/strict";
import test from "node:test";
import discoverPackageJson from "../examples/discover-package.json";
import {
  ContentManager,
  ContentValidationError,
  ContentValidator,
} from "../content-manager";
import type { ContentPackage } from "../types";

const fixture = discoverPackageJson as ContentPackage;

test("ContentValidator accepte un package conforme", () => {
  const result = new ContentValidator().validate(fixture);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("ContentValidator signale les champs et références invalides", () => {
  const invalid = {
    ...fixture,
    articleMarkdown: "",
    metadata: { ...fixture.metadata, title: "" },
    sections: [{ ...fixture.sections[0], imageReference: "missing-image" }],
  } as ContentPackage;
  const result = new ContentValidator().validate(invalid);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("articleMarkdown")));
  assert.ok(result.errors.some((error) => error.includes("metadata.title")));
  assert.ok(result.errors.some((error) => error.includes("missing-image")));
  assert.throws(() => new ContentManager().create(invalid), ContentValidationError);
});
