import type { EditorId } from "../../../../ai/types";

export type AiPublisherEventType =
  | "publish:start"
  | "publish:validated"
  | "publish:prepared"
  | "transaction:start"
  | "transaction:commit"
  | "transaction:rollback"
  | "publish:success"
  | "publish:error";

export interface AiPublisherEvent {
  readonly type: AiPublisherEventType;
  readonly operationId: string;
  readonly packageId: string;
  readonly editor: EditorId;
  readonly timestamp: string;
  readonly message?: string;
}

export type AiPublisherEventListener = (event: AiPublisherEvent) => void;

/** Bus synchrone sans connexion à une infrastructure externe. */
export class AiPublisherEventBus {
  private readonly listeners = new Set<AiPublisherEventListener>();

  public on(listener: AiPublisherEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public emit(event: AiPublisherEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
