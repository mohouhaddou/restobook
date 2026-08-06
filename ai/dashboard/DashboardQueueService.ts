import type { AIBridge } from "../bridge/AIBridge";
import type { Job } from "../jobs/Job";
export class DashboardQueueService {
  public constructor(private readonly bridge: AIBridge) {}
  public list(): readonly Job[] { return this.bridge.jobs.list(); }
  public pause(): void { this.bridge.pause(); }
  public resume(): void { this.bridge.resume(); }
  public reprioritize(id: string, priority: Job["priority"]): Promise<Job> { return this.bridge.jobs.reprioritize(id, priority); }
}
