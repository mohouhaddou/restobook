export class AIImportError extends Error { constructor(message:string,readonly code:string,readonly details:readonly string[]=[]){super(message);this.name="AIImportError";} }
export class AIImportValidationError extends AIImportError { constructor(errors:readonly string[]){super("Package IA invalide.","AI_IMPORT_VALIDATION",errors);} }
export class AIImportExtractionError extends AIImportError { constructor(message:string){super(message,"AI_IMPORT_EXTRACTION");} }
export class AIImportPublishError extends AIImportError { constructor(message:string){super(message,"AI_IMPORT_PUBLISH");} }
