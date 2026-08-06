import type { AIBridge } from "../bridge/AIBridge";
import type { CreateJobInput, Job } from "../jobs/Job";
export class DashboardJobService {
  public constructor(private readonly bridge: AIBridge) {}
  public create(input: CreateJobInput): Promise<Job> { return this.bridge.createJob(input); }
  public cancel(id: string): Promise<Job> { return this.bridge.cancel(id); }
  public retry(id: string): Promise<Job> { return this.bridge.retry(id); }
  public get(id: string): Job { return this.bridge.jobs.get(id); }
}
