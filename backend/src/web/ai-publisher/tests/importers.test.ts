import assert from "node:assert/strict";
import test from "node:test";
import discoverJson from "../../../../../ai/examples/discover-package.json";
import gamingJson from "../../../../../ai/examples/gaming-package.json";
import kidsJson from "../../../../../ai/examples/kids-package.json";
import sportsJson from "../../../../../ai/examples/sports-package.json";
import storiesJson from "../../../../../ai/examples/stories-package.json";
import type { ContentPackage } from "../../../../../ai/types";
import {
  DiscoverImporter,
  GamingImporter,
  KidsImporter,
  SportsImporter,
  StoriesImporter,
} from "../importers";

test("les cinq importers partagent le mapping commun sans duplication", () => {
  const cases = [
    [new DiscoverImporter(), discoverJson],
    [new SportsImporter(), sportsJson],
    [new KidsImporter(), kidsJson],
    [new StoriesImporter(), storiesJson],
    [new GamingImporter(), gamingJson],
  ] as const;
  for (const [importer, json] of cases) {
    const content = json as ContentPackage;
    const record = importer.prepare(content);
    assert.equal(record.editor, content.editor);
    assert.equal(record.packageId, content.id);
    assert.equal(record.markdown, content.articleMarkdown);
    assert.ok(record.target.endsWith("_articles"));
  }
});
