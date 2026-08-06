import type { FileEventType } from "./FileEvents";

/** Entrée de journal technique conservée en mémoire. */
export interface FileLogEntry {
  readonly level: "info" | "warning" | "error";
  readonly operation: FileEventType | "scan" | "validate";
  readonly path: string;
  readonly message: string;
  readonly timestamp: string;
}

/** Journal injectable, sans écriture automatique dans `workspace/logs`. */
export class FileLogger {
  private readonly entries: FileLogEntry[] = [];

  public constructor(private readonly now: () => Date = () => new Date()) {}

  public log(entry: Omit<FileLogEntry, "timestamp">): FileLogEntry {
    const complete = { ...entry, timestamp: this.now().toISOString() };
    this.entries.push(complete);
    return { ...complete };
  }

  public list(): readonly FileLogEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
