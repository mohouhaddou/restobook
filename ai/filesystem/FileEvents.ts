/** Événements observables émis par le connecteur. */
export type FileEventType =
  | "workspace:created"
  | "workspace:cleared"
  | "workspace:archived"
  | "workspace:deleted"
  | "package:written"
  | "package:read";

/** Description immutable d'une opération de fichiers. */
export interface FileEvent {
  readonly type: FileEventType;
  readonly path: string;
  readonly timestamp: string;
}

export type FileEventListener = (event: FileEvent) => void;

/** Bus d'événements synchrone et indépendant. */
export class FileEventBus {
  private readonly listeners = new Set<FileEventListener>();

  public on(listener: FileEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public emit(event: FileEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
