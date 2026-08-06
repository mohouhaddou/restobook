/** États canoniques d'un job, indépendants de tout fournisseur. */
export const JOB_STATUSES = [
  "PENDING", "VALIDATING", "SELECT_PROVIDER", "SELECT_EDITOR", "GENERATE",
  "VALIDATE", "GENERATE_IMAGES", "GENERATE_METADATA", "PACKAGE", "WORKFLOW",
  "PUBLISH", "SUCCESS", "FAILED", "PAUSED", "CANCELLED", "RETRYING",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = ["SUCCESS", "FAILED", "CANCELLED"];
