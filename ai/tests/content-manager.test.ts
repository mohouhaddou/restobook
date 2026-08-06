import assert from "node:assert/strict";
import test from "node:test";
import discoverPackageJson from "../examples/discover-package.json";
import {
  ContentManager,
  ContentNotFoundError,
} from "../content-manager";
import type { ContentPackage } from "../types";

const fixture = discoverPackageJson as ContentPackage;
const clock = () => new Date("2026-07-23T12:00:00.000Z");

test("ContentManager couvre le cycle de vie en mémoire", () => {
  const manager = new ContentManager({ now: clock });
  const created = manager.create(fixture);

  assert.equal(created.version, "v1");
  assert.equal(manager.load(fixture.id).id, fixture.id);
  assert.deepEqual(manager.list().map((content) => content.id), [fixture.id]);

  manager.archive(fixture.id);
  assert.equal(manager.list().length, 0);
  assert.equal(manager.list(true).length, 1);
  manager.restore(fixture.id);

  const duplicate = manager.duplicate(fixture.id, { id: "discover-copy" });
  assert.equal(duplicate.version, "v1");
  assert.equal(manager.load("discover-copy").metadata.slug, `${fixture.metadata.slug}-copy`);

  manager.delete("discover-copy");
  assert.throws(() => manager.load("discover-copy"), ContentNotFoundError);
  assert.equal(manager.history("discover-copy").length, 1);
});

test("ContentManager normalise sans muter le package source", () => {
  const manager = new ContentManager({ now: clock });
  const source = {
    ...structuredClone(fixture),
    category: " Guide Local ",
    articleMarkdown: `${fixture.articleMarkdown}\r\n\r\n\r\n`,
    metadata: {
      ...fixture.metadata,
      slug: "  Découvrir : Les Jardins  ",
      tags: [" Ville ", "ville"],
    },
  } as ContentPackage;

  const normalized = manager.normalize(source);
  assert.equal(normalized.category, "guide-local");
  assert.equal(normalized.metadata.slug, "decouvrir-les-jardins");
  assert.deepEqual(normalized.metadata.tags, ["ville"]);
  assert.ok(normalized.articleMarkdown.endsWith("\n"));
  assert.equal(source.category, " Guide Local ");
});
