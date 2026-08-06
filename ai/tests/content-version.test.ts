import assert from "node:assert/strict";
import test from "node:test";
import discoverPackageJson from "../examples/discover-package.json";
import { ContentManager } from "../content-manager";
import type { ContentPackage } from "../types";

const fixture = discoverPackageJson as ContentPackage;

test("chaque sauvegarde crée une version séquentielle accessible", () => {
  const manager = new ContentManager();
  manager.create(fixture);
  manager.save({ ...manager.load(fixture.id), articleMarkdown: "# Version deux" });
  manager.save({ ...manager.load(fixture.id), articleMarkdown: "# Version trois" });

  assert.deepEqual(
    manager.history(fixture.id).map((record) => record.version),
    ["v1", "v2", "v3"],
  );
  assert.ok(manager.load(fixture.id, "v1").articleMarkdown.includes("jardins urbains"));
  assert.equal(manager.load(fixture.id, "v2").articleMarkdown, "# Version deux\n");
  assert.equal(manager.load(fixture.id, "v3").articleMarkdown, "# Version trois\n");
});

test("la comparaison identifie les familles de changements", () => {
  const manager = new ContentManager();
  manager.create(fixture);
  const updated = {
    ...manager.load(fixture.id),
    sections: [{ ...fixture.sections[0], content: "Contenu modifié.", imageReference: undefined }],
    images: [],
    metadata: { ...fixture.metadata, title: "Titre modifié" },
    seo: { ...fixture.seo, title: "SEO modifié" },
  } as ContentPackage;
  manager.save(updated);

  const comparison = manager.compare(fixture.id, "v1", "v2");
  assert.equal(comparison.modifiedSections.length, 1);
  assert.equal(comparison.seoModified, true);
  assert.equal(comparison.metadataModified, true);
  assert.equal(comparison.imagesRemoved.length, 1);
  assert.equal(comparison.imagesAdded.length, 0);
});
