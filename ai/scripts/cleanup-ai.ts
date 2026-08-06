import { readdir, rm } from "node:fs/promises";
import path from "node:path";

/** Nettoie uniquement les enfants de `workspace/temp` sous la racine fournie. */
export async function cleanupAI(aiRoot = path.resolve(process.cwd())): Promise<number> {
  const temporary = path.resolve(aiRoot, "workspace", "temp");
  const relative = path.relative(path.resolve(aiRoot), temporary);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Chemin temporaire non sûr.");
  }
  const entries = await readdir(temporary);
  await Promise.all(entries
    .filter((entry) => entry !== "README.md")
    .map((entry) => rm(path.join(temporary, entry), { recursive: true, force: true })));
  console.log(`${entries.length} entrée(s) temporaire(s) inspectée(s).`);
  return entries.filter((entry) => entry !== "README.md").length;
}
