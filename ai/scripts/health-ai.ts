import path from "node:path";
import { Bootstrap } from "../bootstrap";
import type { BootstrapEnvironment } from "../bootstrap";
import { loadConfiguration } from "./ScriptRuntime";

export async function healthAI(
  aiRoot = path.resolve(process.cwd()),
  environment: BootstrapEnvironment = "default",
) {
  const configuration = await loadConfiguration(aiRoot, environment);
  const { report } = await new Bootstrap({ aiRoot, configuration }).run();
  console.log(JSON.stringify({ status: report.summary, checks: report.checks }, null, 2));
  return report;
}
