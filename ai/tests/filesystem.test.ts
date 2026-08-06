import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import fixtureJson from "../examples/discover-package.json";
import { FileSystemConnector } from "../filesystem";
import type { ContentPackage } from "../types";

const fixture = fixtureJson as ContentPackage;

test("FileSystemConnector dépose puis récupère un ContentPackage", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "ifilino-filesystem-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const connector = new FileSystemConnector(root);
  await connector.workspaces.createWorkspace();
  await connector.writePackage("incoming", fixture, {
    "cover.webp": new Uint8Array([82, 73, 70, 70]),
  });

  const loaded = await connector.readPackage("incoming", fixture.id);
  assert.deepEqual(loaded, fixture);
  assert.equal(connector.events instanceof Object, true);
  assert.equal(connector.logger.list().length, 2);
});
