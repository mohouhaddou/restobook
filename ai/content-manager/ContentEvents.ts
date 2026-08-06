/** Types d’événements émis par le Content Package Manager. */
export type ContentEventType =
  | 'content:created'
  | 'content:saved'
  | 'content:archived'
  | 'content:restored'
  | 'content:duplicated'
  | 'content:deleted';

/** Événement immutable décrivant une transition de paquet. */
export interface ContentEvent {
  /** Type stable de l’événement. */
  readonly type: ContentEventType;
  /** Identifiant du paquet concerné. */
  readonly contentId: string;
  /** Version créée par l’opération, le cas échéant. */
  readonly version?: string;
  /** Identifiant source lors d’une duplication. */
  readonly sourceContentId?: string;
  /** Date ISO 8601 de l’événement. */
  readonly timestamp: string;
}

/** Abonné synchrone à un événement du gestionnaire. */
export type ContentEventListener = (event: ContentEvent) => void;

/** Bus d’événements en mémoire, sans dépendance externe. */
export class ContentEventBus {
  private readonly listeners = new Set<ContentEventListener>();

  /** Enregistre un abonné et retourne sa fonction de désabonnement. */
  on(listener: ContentEventListener): () => void {
    this.listeners.add(listener);
    return () => this.off(listener);
  }

  /** Retire un abonné. */
  off(listener: ContentEventListener): void {
    this.listeners.delete(listener);
  }

  /** Diffuse un événement aux abonnés présents. */
  emit(event: ContentEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
