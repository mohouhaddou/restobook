import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { BootstrapConfiguration } from "./BootstrapConfiguration";
import type { BootstrapValidationCheck } from "./BootstrapReport";

export interface BootstrapValidationResult {
  readonly valid: boolean;
  readonly checks: readonly BootstrapValidationCheck[];
  readonly fileCount: number;
  readonly circularDependencies: readonly string[];
}

const CHECKS: Readonly<Record<string, readonly string[]>> = {
  Architecture: ["README.md", "config", "types"],
  Types: ["types/ContentPackage.ts", "types/Metadata.ts"],
  Workflow: ["workflow-engine/index.ts", "workflows/discover.workflow.json"],
  Publisher: ["publisher/index.ts"],
  "Content Manager": ["content-manager/index.ts"],
  FileSystem: ["filesystem/index.ts", "workspace/incoming"],
  Integration: ["integration/index.ts", "adapters/index.ts"],
  Backend: ["../backend/src/modules/ai-publisher/index.ts"],
  Orchestrator: ["orchestrator/index.ts", "jobs/index.ts"],
  Configuration: ["config/default.json", "config/production.json"],
  Documentation: ["docs/Architecture.md", "docs/Maintenance.md"],
  Exemples: ["examples/example-content-package", "examples/example-configuration"],
  Tests: ["tests/orchestrator.test.ts", "tests/content-package.test.ts"],
};

/** Valide globalement fichiers, configuration et graphe d'imports locaux. */
export class BootstrapValidator {
  public constructor(private readonly aiRoot: string) {}

  public async validate(configuration: BootstrapConfiguration): Promise<BootstrapValidationResult> {
    const checks: BootstrapValidationCheck[] = [];
    for (const [name, targets] of Object.entries(CHECKS)) {
      const missing: string[] = [];
      for (const target of targets) {
        try {
          await access(path.resolve(this.aiRoot, target));
        } catch {
          missing.push(target);
        }
      }
      checks.push({
        name,
        valid: missing.length === 0,
        details: missing.length ? `Absents : ${missing.join(", ")}` : "OK",
      });
    }
    const configurationErrors = this.validateConfiguration(configuration);
    if (configurationErrors.length) {
      const index = checks.findIndex((check) => check.name === "Configuration");
      checks[index] = { name: "Configuration", valid: false, details: configurationErrors.join("; ") };
    }
    const files = await this.files(this.aiRoot);
    const circularDependencies = await this.findCircularDependencies(files);
    checks.push({
      name: "Dépendances circulaires",
      valid: circularDependencies.length === 0,
      details: circularDependencies.length ? circularDependencies.join("; ") : "OK",
    });
    return {
      valid: checks.every((check) => check.valid),
      checks,
      fileCount: files.length,
      circularDependencies,
    };
  }

  private validateConfiguration(configuration: BootstrapConfiguration): readonly string[] {
    const errors: string[] = [];
    if (!configuration.version.trim()) errors.push("version absente");
    if (!configuration.workspace.root.trim()) errors.push("workspace.root absent");
    if (configuration.retry.maxAttempts < 1) errors.push("retry.maxAttempts invalide");
    if (configuration.scheduler.concurrency < 1) errors.push("scheduler.concurrency invalide");
    return errors;
  }

  private async files(directory: string): Promise<readonly string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries
      .filter((entry) => !["node_modules", ".build", ".test-dist"].includes(entry.name))
      .map(async (entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? this.files(target) : [target];
      }));
    return nested.flat();
  }

  private async findCircularDependencies(files: readonly string[]): Promise<readonly string[]> {
    const sourceFiles = files.filter((file) => file.endsWith(".ts"));
    const graph = new Map<string, string[]>();
    const sourceSet = new Set(sourceFiles.map((file) => path.resolve(file)));
    for (const file of sourceFiles) {
      const text = await readFile(file, "utf8");
      const dependencies: string[] = [];
      for (const match of text.matchAll(/^(?!\s*(?:import|export)\s+type\b)\s*(?:import|export)[^\n]*from\s+["'](\.[^"']+)["']/gm)) {
        const base = path.resolve(path.dirname(file), match[1]);
        const candidates = [`${base}.ts`, path.join(base, "index.ts")];
        const resolved = candidates.find((candidate) => sourceSet.has(candidate));
        if (resolved) dependencies.push(resolved);
      }
      graph.set(path.resolve(file), dependencies);
    }
    const cycles = new Set<string>();
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const walk = (node: string, stack: readonly string[]): void => {
      if (visiting.has(node)) {
        cycles.add([...stack.slice(stack.indexOf(node)), node]
          .map((file) => path.relative(this.aiRoot, file)).join(" -> "));
        return;
      }
      if (visited.has(node)) return;
      visiting.add(node);
      for (const dependency of graph.get(node) ?? []) walk(dependency, [...stack, node]);
      visiting.delete(node);
      visited.add(node);
    };
    for (const file of sourceFiles) walk(path.resolve(file), []);
    return [...cycles].sort();
  }
}
