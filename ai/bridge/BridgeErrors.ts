export class BridgeError extends Error {
  public constructor(message: string, readonly code: string, readonly cause?: unknown) {
    super(message); this.name = "BridgeError";
  }
}
export class JobNotFoundError extends BridgeError {
  public constructor(id: string) { super(`Job introuvable : ${id}`, "JOB_NOT_FOUND"); }
}
export class JobCancelledError extends BridgeError {
  public constructor(id: string) { super(`Job annulé : ${id}`, "JOB_CANCELLED"); }
}
