import type { BootstrapConfiguration } from "./BootstrapConfiguration";
import type { BootstrapReport } from "./BootstrapReport";

/** Produit le tableau de bord console, sans démarrer de worker implicite. */
export class SystemStartup {
  public render(configuration: BootstrapConfiguration, report: BootstrapReport): string {
    const services = report.checks
      .filter((check) => [
        "Workflow",
        "Publisher",
        "Content Manager",
        "Integration",
        "Backend",
        "Orchestrator",
      ].includes(check.name))
      .map((check) => `${check.name}: ${check.valid ? "OK" : "ERROR"}`)
      .join("\n");
    return [
      "=================================================",
      "iFilino AI Editorial Platform",
      `Version: ${report.version}`,
      `Modules chargés: ${report.activeModules.join(", ") || "aucun"}`,
      `Configuration active: ${configuration.environment}`,
      `Health Check: ${report.summary}`,
      services,
      report.summary,
      "=================================================",
    ].join("\n");
  }
}
