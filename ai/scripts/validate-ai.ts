import path from "node:path";
import { BootstrapValidator } from "../bootstrap";
import type { BootstrapEnvironment } from "../bootstrap";
import { loadConfiguration } from "./ScriptRuntime";

export async function validateAI(
  aiRoot = path.resolve(process.cwd()),
  environment: BootstrapEnvironment = "default",
) {
  const result = await new BootstrapValidator(aiRoot)
    .validate(await loadConfiguration(aiRoot, environment));
  console.log(JSON.stringify(result, null, 2));
  return result;
}
