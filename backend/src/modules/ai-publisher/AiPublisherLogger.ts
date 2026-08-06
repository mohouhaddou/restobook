import type { AiPublisherEventType } from "./AiPublisherEvents";

export interface AiPublisherLogEntry {
  readonly timestamp: string;
  readonly level: "info" | "warning" | "error";
  readonly event: AiPublisherEventType;
  readonly operationId: string;
  readonly packageId: string;
  readonly message: string;
}

/** Journal backend en mémoire, remplaçable par injection. */
export class AiPublisherLogger {
  private readonly entries: AiPublisherLogEntry[] = [];

  public constructor(private readonly now: () => Date = () => new Date()) {}

  public log(entry: Omit<AiPublisherLogEntry, "timestamp">): AiPublisherLogEntry {
    const complete = { ...entry, timestamp: this.now().toISOString() };
    this.entries.push(complete);
    return { ...complete };
  }

  public list(operationId?: string): readonly AiPublisherLogEntry[] {
    return this.entries
      .filter((entry) => !operationId || entry.operationId === operationId)
      .map((entry) => ({ ...entry }));
  }
}
