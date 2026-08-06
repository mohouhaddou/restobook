export { EventBus, JOB_EVENT_TYPES, type JobEvent, type JobEventListener, type JobEventType } from "../jobs/JobEvents";

export const WEBSOCKET_EVENT_NAMES = {
  JOB_CREATED: "job-created", JOB_STARTED: "job-started", JOB_PROGRESS: "job-progress",
  JOB_LOG: "job-log", JOB_WARNING: "job-warning", JOB_ERROR: "job-error",
  JOB_SUCCESS: "job-success", JOB_FAILED: "job-failed", QUEUE_UPDATED: "queue-updated",
  SYSTEM_HEALTH: "system-health",
} as const;
