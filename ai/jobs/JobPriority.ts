/** Priorités ordonnées utilisées par la file. */
export const JOB_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];
export const JOB_PRIORITY_WEIGHT: Readonly<Record<JobPriority, number>> = {
  LOW: 0, NORMAL: 10, HIGH: 20, CRITICAL: 30,
};
