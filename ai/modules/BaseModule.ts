import type { ModuleLifecycle, ModuleState } from "./ModuleLifecycle";
import type { ModuleManifest } from "./ModuleManifest";
export abstract class BaseModule implements ModuleLifecycle {
  public state: ModuleState = "REGISTERED";
  public constructor(public readonly manifest: ModuleManifest) {}
  public async start(): Promise<void> { this.state = "RUNNING"; }
  public async stop(): Promise<void> { this.state = "STOPPED"; }
  public async health(): Promise<boolean> { return this.state === "RUNNING"; }
}
