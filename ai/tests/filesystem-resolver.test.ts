import assert from "node:assert/strict";
import test from "node:test";
import { PathResolver, UnsafePathError } from "../filesystem";

test("PathResolver résout et confine les chemins", () => {
  const resolver = new PathResolver("/tmp/ifilino-workspace");
  assert.equal(
    resolver.resolve("incoming", "package-1"),
    "/tmp/ifilino-workspace/incoming/package-1",
  );
  assert.equal(resolver.relative(resolver.resolve("failed", "package-2")), "failed/package-2");
  assert.throws(() => resolver.resolve("..", "outside"), UnsafePathError);
});

test("PathResolver normalise les syntaxes Windows et POSIX", () => {
  const resolver = new PathResolver("/tmp/ifilino-workspace");
  assert.equal(resolver.normalize("a\\b\\..\\c", "windows"), "a\\c");
  assert.equal(resolver.normalize("a/b/../c", "posix"), "a/c");
  assert.equal(resolver.isAbsolute("C:\\workspace", "windows"), true);
  assert.equal(resolver.isAbsolute("/workspace", "posix"), true);
});
