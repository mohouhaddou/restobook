import assert from "node:assert/strict";
import test from "node:test";
import discoverPackageJson from "../examples/discover-package.json";
import { ContentManager } from "../content-manager";
import type { ContentPackage } from "../types";

const fixture = discoverPackageJson as ContentPackage;

test("ContentHistory conserve des snapshots indépendants", () => {
  const manager = new ContentManager();
  manager.create(fixture);
  const loaded = manager.load(fixture.id) as ContentPackage & {
    articleMarkdown: string;
  };
  loaded.articleMarkdown = "mutation locale";

  assert.notEqual(manager.load(fixture.id).articleMarkdown, "mutation locale");
  assert.notEqual(manager.load(fixture.id, "v1").articleMarkdown, "mutation locale");
});

test("l'historique reste disponible après archivage et suppression", () => {
  const manager = new ContentManager();
  manager.create(fixture);
  manager.archive(fixture.id);
  manager.delete(fixture.id);

  assert.equal(manager.history(fixture.id).length, 1);
  assert.equal(manager.load(fixture.id, "v1").id, fixture.id);
});
