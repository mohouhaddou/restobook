import type { Job } from "../jobs/Job";

export interface BridgeLogRecord {
  readonly timestamp: string;
  readonly level: "info" | "warning" | "error";
  readonly message: string;
  readonly jobId?: string;
}
export interface BridgeLogSink { write(record: BridgeLogRecord): void; }
export class BridgeLogger {
  public constructor(private readonly sink?: BridgeLogSink, private readonly now = () => new Date()) {}
  public write(level: BridgeLogRecord["level"], message: string, job?: Job): void {
    const record = { timestamp: this.now().toISOString(), level, message, jobId: job?.id };
    job?.logs.push({ timestamp: record.timestamp, level, message });
    this.sink?.write(record);
  }
}
