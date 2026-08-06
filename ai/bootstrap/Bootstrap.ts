import type { BootstrapConfiguration } from "./BootstrapConfiguration";
import { BootstrapLogger } from "./BootstrapLogger";
import type { BootstrapReport } from "./BootstrapReport";
import { BootstrapValidator } from "./BootstrapValidator";
import { SystemStartup } from "./SystemStartup";

export interface BootstrapOptions {
  readonly aiRoot: string;
  readonly configuration: BootstrapConfiguration;
  readonly testsExecuted?: number;
  readonly testsPassed?: number;
  readonly now?: () => Date;
}

/** Assemble validation, rapport et tableau de bord de démarrage. */
export class Bootstrap {
  public readonly logger: BootstrapLogger;
  private readonly validator: BootstrapValidator;
  private readonly startup = new SystemStartup();
  private readonly now: () => Date;

  public constructor(private readonly options: BootstrapOptions) {
    this.now = options.now ?? (() => new Date());
    this.logger = new BootstrapLogger(this.now);
    this.validator = new BootstrapValidator(options.aiRoot);
  }

  public async run(): Promise<{ readonly report: BootstrapReport; readonly dashboard: string }> {
    const started = this.now();
    this.logger.log("info", "Validation globale démarrée.");
    const validation = await this.validator.validate(this.options.configuration);
    const modules = Object.entries(this.options.configuration.modules);
    const activeModules = modules.filter(([, enabled]) => enabled).map(([name]) => name);
    const disabledModules = modules.filter(([, enabled]) => !enabled).map(([name]) => name);
    const finished = this.now();
    const report: BootstrapReport = {
      summary: validation.valid ? "READY" : "INVALID",
      componentCount: validation.checks.length,
      fileCount: validation.fileCount,
      activeModules,
      disabledModules,
      testsExecuted: this.options.testsExecuted ?? 0,
      testsPassed: this.options.testsPassed ?? 0,
      startupTimeMs: Math.max(0, finished.getTime() - started.getTime()),
      version: this.options.configuration.version,
      date: finished.toISOString(),
      environment: this.options.configuration.environment,
      checks: validation.checks,
      circularDependencies: validation.circularDependencies,
    };
    this.logger.log(report.summary === "READY" ? "info" : "error", report.summary);
    return { report, dashboard: this.startup.render(this.options.configuration, report) };
  }
}
