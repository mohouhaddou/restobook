import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FileValidator } from "../filesystem";

test("FileValidator accepte la convention complète", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "ifilino-package-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "images"));
  await Promise.all([
    writeFile(path.join(directory, "article.md"), "# Article"),
    writeFile(path.join(directory, "metadata.json"), "{}"),
    writeFile(path.join(directory, "images", "cover.webp"), new Uint8Array([1])),
  ]);
  assert.equal((await new FileValidator().validate(directory)).valid, true);
});

test("FileValidator détaille les éléments absents", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "ifilino-package-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const result = await new FileValidator().validate(directory);
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 4);
});
