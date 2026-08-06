import type { PublishError } from "./PublishError";
import type { PublishResult } from "./PublishResult";

/** Rapport complet produit par le service pour chaque tentative. */
export interface PublishReport {
  readonly operationId: string;
  readonly packageId: string;
  readonly status: "SUCCESS" | "ERROR";
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly transactionStatus: "COMMITTED" | "ROLLED_BACK" | "NOT_STARTED";
  readonly result?: PublishResult;
  readonly errors: readonly PublishError[];
  readonly warnings: readonly string[];
}
