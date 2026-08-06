import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BootstrapConfiguration, BootstrapEnvironment } from "../bootstrap";

export async function loadConfiguration(
  aiRoot: string,
  environment: BootstrapEnvironment = "default",
): Promise<BootstrapConfiguration> {
  const text = await readFile(path.join(aiRoot, "config", `${environment}.json`), "utf8");
  return JSON.parse(text) as BootstrapConfiguration;
}
