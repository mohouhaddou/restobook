import path from "node:path";
import { Bootstrap } from "../bootstrap";
import type { BootstrapEnvironment } from "../bootstrap";
import { loadConfiguration } from "./ScriptRuntime";

export async function startAI(
  aiRoot = path.resolve(process.cwd()),
  environment: BootstrapEnvironment = "default",
) {
  const configuration = await loadConfiguration(aiRoot, environment);
  const result = await new Bootstrap({ aiRoot, configuration }).run();
  console.log(result.dashboard);
  return result;
}
