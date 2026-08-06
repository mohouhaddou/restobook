import type { OrchestratorContext } from "./OrchestratorContext";
import { OrchestratorJobNotFoundError } from "./OrchestratorErrors";

/** File FIFO en mémoire avec index de tous les jobs. */
export class OrchestratorQueue {
  private readonly pending: string[] = [];
  private readonly jobs = new Map<string, OrchestratorContext>();

  public enqueue(context: OrchestratorContext): void {
    this.jobs.set(context.jobId, context);
    this.pending.push(context.jobId);
  }

  public dequeue(): OrchestratorContext | undefined {
    const id = this.pending.shift();
    return id ? this.jobs.get(id) : undefined;
  }

  public get(jobId: string): OrchestratorContext {
    const context = this.jobs.get(jobId);
    if (!context) throw new OrchestratorJobNotFoundError(jobId);
    return context;
  }

  public removePending(jobId: string): boolean {
    const index = this.pending.indexOf(jobId);
    if (index < 0) return false;
    this.pending.splice(index, 1);
    return true;
  }

  public list(): readonly OrchestratorContext[] {
    return [...this.jobs.values()];
  }

  public pendingCount(): number {
    return this.pending.length;
  }

  public clear(): void {
    this.pending.length = 0;
  }
}
