import type { IntegrationEventType } from "./IntegrationEvents";

export interface IntegrationLogEntry {
  readonly timestamp: string;
  readonly level: "info" | "warning" | "error";
  readonly event: IntegrationEventType;
  readonly integrationId: string;
  readonly packageId: string;
  readonly message: string;
}

/** Journal technique conservé uniquement en mémoire. */
export class IntegrationLogger {
  private readonly entries: IntegrationLogEntry[] = [];

  public constructor(private readonly now: () => Date = () => new Date()) {}

  public log(entry: Omit<IntegrationLogEntry, "timestamp">): IntegrationLogEntry {
    const complete = { ...entry, timestamp: this.now().toISOString() };
    this.entries.push(complete);
    return { ...complete };
  }

  public list(integrationId?: string): readonly IntegrationLogEntry[] {
    return this.entries
      .filter((entry) => !integrationId || entry.integrationId === integrationId)
      .map((entry) => ({ ...entry }));
  }
}
