export interface BootstrapLogEntry {
  readonly timestamp: string;
  readonly level: "info" | "warning" | "error";
  readonly message: string;
}

export class BootstrapLogger {
  private readonly entries: BootstrapLogEntry[] = [];
  public constructor(private readonly now: () => Date = () => new Date()) {}
  public log(level: BootstrapLogEntry["level"], message: string): BootstrapLogEntry {
    const entry = { level, message, timestamp: this.now().toISOString() };
    this.entries.push(entry);
    return { ...entry };
  }
  public list(): readonly BootstrapLogEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
