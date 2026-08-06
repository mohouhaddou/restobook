import type { Job } from "./Job";
import type { JobPersistence } from "./JobPersistence";

export class JobHistory {
  public constructor(private readonly persistence: JobPersistence) {}
  public async list(): Promise<readonly Job[]> { return this.persistence.load(); }
  public async get(id: string): Promise<Job | undefined> {
    return (await this.persistence.load()).find(job => job.id === id);
  }
}
