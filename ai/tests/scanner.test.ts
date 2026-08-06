import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import fixtureJson from "../examples/discover-package.json";
import { FileSystemConnector } from "../filesystem";
import type { ContentPackage } from "../types";

const fixture = fixtureJson as ContentPackage;

test("PackageScanner parcourt les quatre états et retourne les packages", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "ifilino-scanner-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const connector = new FileSystemConnector(root);
  await connector.workspaces.createWorkspace();

  await connector.writePackage("incoming", fixture, {
    "cover.webp": new Uint8Array([1]),
  });
  await connector.writePackage(
    "failed",
    { ...fixture, id: "failed-package" },
    { "cover.webp": new Uint8Array([1]) },
  );

  const scanned = await connector.scanPackageEntries();
  assert.deepEqual(
    scanned.map((entry) => [entry.state, entry.package.id]),
    [["incoming", fixture.id], ["failed", "failed-package"]],
  );
});
