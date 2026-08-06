export class PublishDomainError extends Error{constructor(public readonly code:string,message:string,public readonly cause?:unknown){super(message);this.name=new.target.name;}}
export class AlreadyExistsError extends PublishDomainError{constructor(){super("ALREADY_EXISTS","Cet article existe déjà.");}}
export class InvalidImportJobError extends PublishDomainError{constructor(public readonly details:readonly string[]){super("INVALID_IMPORT_JOB",details.join(" "));}}
