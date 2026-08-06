import type { ContentPackage } from "../types";
import type { EditorId, ContentLanguage } from "../types/Metadata";
import type { JobPriority } from "./JobPriority";
import type { JobStatus } from "./JobStatus";

export interface JobLogEntry {
  readonly timestamp: string;
  readonly level: "info" | "warning" | "error";
  readonly message: string;
}

export interface JobExecutionResult {
  readonly contentPackage?: ContentPackage;
  readonly providerResponse?: string;
  readonly published?: boolean;
}

/** Agrégat DDD représentant une demande créée par le Dashboard. */
export interface Job {
  readonly id: string;
  readonly editor: EditorId;
  provider?: string;
  readonly topic: string;
  readonly language: ContentLanguage;
  status: JobStatus;
  progress: number;
  priority: JobPriority;
  readonly createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  attempts: number;
  nextAttemptAt?: string;
  logs: JobLogEntry[];
  warnings: string[];
  errors: string[];
  result?: JobExecutionResult;
}

export interface CreateJobInput {
  readonly editor: EditorId;
  readonly topic: string;
  readonly language: ContentLanguage;
  readonly provider?: string;
  readonly priority?: JobPriority;
}
