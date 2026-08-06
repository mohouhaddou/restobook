import type { AIBridge } from "../bridge/AIBridge";
import type { JobEventListener } from "../jobs/JobEvents";
export class DashboardProgressService {
  public constructor(private readonly bridge: AIBridge) {}
  public subscribe(listener: JobEventListener): () => void { return this.bridge.on("*", listener); }
}
