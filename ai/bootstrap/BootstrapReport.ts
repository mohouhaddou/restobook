import type { BootstrapEnvironment } from "./BootstrapConfiguration";

export interface BootstrapValidationCheck {
  readonly name: string;
  readonly valid: boolean;
  readonly details: string;
}

/** Rapport global demandé au démarrage et à la validation. */
export interface BootstrapReport {
  readonly summary: "READY" | "INVALID";
  readonly componentCount: number;
  readonly fileCount: number;
  readonly activeModules: readonly string[];
  readonly disabledModules: readonly string[];
  readonly testsExecuted: number;
  readonly testsPassed: number;
  readonly startupTimeMs: number;
  readonly version: string;
  readonly date: string;
  readonly environment: BootstrapEnvironment;
  readonly checks: readonly BootstrapValidationCheck[];
  readonly circularDependencies: readonly string[];
}
