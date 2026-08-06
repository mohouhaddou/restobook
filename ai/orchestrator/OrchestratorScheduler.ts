export interface ScheduledJob {
  readonly id: string;
  readonly scheduledAt: string;
}

type TimerHandle = ReturnType<typeof setTimeout>;

/** Planificateur injectable ; aucun job n'est créé automatiquement. */
export class OrchestratorScheduler {
  private readonly timers = new Map<string, TimerHandle>();

  public schedule(id: string, date: Date, callback: () => void | Promise<void>): ScheduledJob {
    const delay = Math.max(0, date.getTime() - Date.now());
    const timer = setTimeout(() => {
      this.timers.delete(id);
      void callback();
    }, delay);
    this.timers.set(id, timer);
    return { id, scheduledAt: date.toISOString() };
  }

  public cancel(id: string): boolean {
    const timer = this.timers.get(id);
    if (!timer) return false;
    clearTimeout(timer);
    this.timers.delete(id);
    return true;
  }

  public list(): readonly string[] {
    return [...this.timers.keys()].sort();
  }

  public shutdown(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
