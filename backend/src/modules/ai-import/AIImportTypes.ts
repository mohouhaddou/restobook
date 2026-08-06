import type { ContentPackage } from "../../../../ai/types";

export const AI_IMPORT_STATUSES = ["Waiting","Uploading","Uploaded","Extracting","Validating","Ready","Publishing","Published","Cleaning","Completed","Failed"] as const;
export type AIImportStatus = (typeof AI_IMPORT_STATUSES)[number];
export type AIImportEventName = "import-created"|"upload-progress"|"extract-progress"|"validation-progress"|"publish-progress"|"cleanup-progress"|"import-success"|"import-failed";

export interface AIImportLog { readonly timestamp:string; readonly level:"info"|"warning"|"error"; readonly message:string; }
export interface AIImportRecord {
  readonly id:string; readonly filename:string; module?:string; title?:string; status:AIImportStatus; progress:number;
  readonly createdAt:string; startedAt?:string; finishedAt?:string; duration?:number; logs:AIImportLog[]; errors:string[];
}
export interface AIImportPackage {
  readonly manifest:Readonly<Record<string,unknown>>; readonly publisher:Readonly<Record<string,unknown>>;
  readonly metadata:Readonly<Record<string,unknown>>; readonly articleMarkdown:string; readonly contentPackage:ContentPackage;
  readonly workspace:string; readonly files:readonly string[];
  readonly social:Readonly<Record<string,string>>; readonly assets:readonly string[];
}
export interface AIImportHistoryEntry { readonly date:string; readonly filename:string; readonly module:string; readonly title:string; readonly duration:number; readonly result:"Completed"|"Failed"; readonly errors:readonly string[]; }
