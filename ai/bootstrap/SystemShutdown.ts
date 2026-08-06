export interface ShutdownPort {
  readonly name: string;
  shutdown(): void | Promise<void>;
}

/** Arrête explicitement les composants enregistrés, dans l'ordre inverse. */
export class SystemShutdown {
  public constructor(private readonly ports: readonly ShutdownPort[] = []) {}
  public async shutdown(): Promise<readonly string[]> {
    const stopped: string[] = [];
    for (const port of [...this.ports].reverse()) {
      await port.shutdown();
      stopped.push(port.name);
    }
    return stopped;
  }
}
