import assert from "node:assert/strict";
import test from "node:test";
import discoverPackageJson from "../examples/discover-package.json";
import { ContentStatistics } from "../content-manager";
import type { ContentPackage } from "../types";

const fixture = discoverPackageJson as ContentPackage;

test("ContentStatistics calcule toutes les mesures attendues", () => {
  const content = {
    ...fixture,
    articleMarkdown: "# Titre\n\nUn article avec [un lien](https://example.invalid).\n\n<a href=\"/local\">Local</a>",
  } as ContentPackage;
  const statistics = new ContentStatistics().calculate(content);

  assert.ok(statistics.wordCount > 0);
  assert.equal(statistics.imageCount, fixture.images.length);
  assert.equal(statistics.readingTime, 1);
  assert.equal(statistics.sectionCount, fixture.sections.length);
  assert.equal(statistics.linkCount, 2);
  assert.ok(statistics.packageSize > 0);
});
