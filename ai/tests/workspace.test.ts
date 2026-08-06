import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { WorkspaceManager, WORKSPACE_DIRECTORIES } from "../filesystem";

test("WorkspaceManager gère le cycle de vie d'un espace", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "ifilino-workspace-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const manager = new WorkspaceManager(root);

  await manager.createWorkspace();
  assert.deepEqual((await readdir(root)).sort(), [...WORKSPACE_DIRECTORIES].sort());

  const workspace = await manager.createWorkspace("article-1");
  await writeFile(path.join(workspace, "draft.txt"), "draft");
  await manager.clearWorkspace("article-1");
  assert.deepEqual(await readdir(workspace), []);

  await manager.archiveWorkspace("article-1");
  assert.equal(await manager.workspaceExists("article-1", true), true);
  await manager.deleteWorkspace("article-1");
  assert.equal(await manager.workspaceExists("article-1", true), false);
});
