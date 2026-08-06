export class OrchestratorError extends Error {
  public constructor(public readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OrchestratorError";
  }
}

export class OrchestratorJobNotFoundError extends OrchestratorError {
  public constructor(jobId: string) {
    super("JOB_NOT_FOUND", `Job introuvable : ${jobId}.`);
    this.name = "OrchestratorJobNotFoundError";
  }
}

export class OrchestratorStateError extends OrchestratorError {
  public constructor(message: string) {
    super("INVALID_ORCHESTRATOR_STATE", message);
    this.name = "OrchestratorStateError";
  }
}

export class OrchestratorExecutionError extends OrchestratorError {
  public constructor(message: string, cause?: unknown) {
    super("ORCHESTRATOR_EXECUTION_FAILED", message, { cause });
    this.name = "OrchestratorExecutionError";
  }
}
