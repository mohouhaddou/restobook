export type ModuleState = "REGISTERED" | "STARTING" | "RUNNING" | "STOPPED" | "FAILED";
export interface ModuleLifecycle { start(): Promise<void>; stop(): Promise<void>; health(): Promise<boolean>; }
