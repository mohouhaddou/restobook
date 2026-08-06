import type { OrchestratorJobState } from "./OrchestratorContext";

export type OrchestratorEventType =
  | "job:queued"
  | "job:started"
  | "job:state"
  | "job:retry"
  | "job:success"
  | "job:failed"
  | "job:cancelled"
  | "orchestrator:paused"
  | "orchestrator:resumed"
  | "orchestrator:shutdown";

export interface OrchestratorEvent {
  readonly type: OrchestratorEventType;
  readonly jobId?: string;
  readonly state?: OrchestratorJobState;
  readonly timestamp: string;
  readonly message?: string;
}

export type OrchestratorEventListener = (event: OrchestratorEvent) => void;

export class OrchestratorEventBus {
  private readonly listeners = new Set<OrchestratorEventListener>();
  public on(listener: OrchestratorEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  public emit(event: OrchestratorEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
