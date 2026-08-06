/** Types d'événements de la couche d'intégration. */
export type IntegrationEventType =
  | "integration:start"
  | "integration:validated"
  | "integration:prepared"
  | "integration:completed"
  | "integration:rollback"
  | "integration:error";

export interface IntegrationEvent {
  readonly type: IntegrationEventType;
  readonly integrationId: string;
  readonly packageId: string;
  readonly adapterId: string;
  readonly timestamp: string;
  readonly message?: string;
}

export type IntegrationEventListener = (event: IntegrationEvent) => void;

/** Bus synchrone sans dépendance externe. */
export class IntegrationEventBus {
  private readonly listeners = new Set<IntegrationEventListener>();

  public on(listener: IntegrationEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public emit(event: IntegrationEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
