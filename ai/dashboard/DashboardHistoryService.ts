import type { JobHistory } from "../jobs/JobHistory";
export class DashboardHistoryService {
  public constructor(private readonly history: JobHistory) {}
  public list() { return this.history.list(); }
  public get(id: string) { return this.history.get(id); }
}
