import type { Job } from "./Job";

export const JOB_EVENT_TYPES = [
  "JOB_CREATED", "JOB_STARTED", "PROVIDER_SELECTED", "EDITOR_SELECTED",
  "TEXT_GENERATED", "IMAGES_GENERATED", "METADATA_GENERATED", "PACKAGE_READY",
  "PUBLISH_STARTED", "PUBLISH_FINISHED", "JOB_SUCCESS", "JOB_FAILED",
  "JOB_PROGRESS", "JOB_LOG", "JOB_WARNING", "JOB_ERROR", "QUEUE_UPDATED",
  "SYSTEM_HEALTH",
] as const;
export type JobEventType = (typeof JOB_EVENT_TYPES)[number];

export interface JobEvent {
  readonly type: JobEventType;
  readonly jobId?: string;
  readonly timestamp: string;
  readonly job?: Readonly<Job>;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export type JobEventListener = (event: JobEvent) => void | Promise<void>;

/** Bus synchrone/asynchrone minimal, sans dépendance au Dashboard. */
export class EventBus {
  private readonly listeners = new Map<JobEventType | "*", Set<JobEventListener>>();

  public on(type: JobEventType | "*", listener: JobEventListener): () => void {
    const bucket = this.listeners.get(type) ?? new Set<JobEventListener>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
    return () => bucket.delete(listener);
  }

  public async emit(event: JobEvent): Promise<void> {
    const listeners = [...(this.listeners.get(event.type) ?? []), ...(this.listeners.get("*") ?? [])];
    await Promise.all(listeners.map(listener => listener(event)));
  }
}
