import type { EditorId } from "../types/Metadata";
import type { Job } from "../jobs/Job";

export interface EditorPort {
  readonly id: EditorId;
  readonly label: string;
  preparePrompt(job: Readonly<Job>): string;
}
export class EditorDispatcher {
  private readonly editors = new Map<EditorId, EditorPort>();
  public register(editor: EditorPort): void { this.editors.set(editor.id, editor); }
  public dispatch(job: Readonly<Job>): EditorPort {
    const editor = this.editors.get(job.editor);
    if (!editor) throw new Error(`EDITOR_NOT_FOUND:${job.editor}`);
    return editor;
  }
}
export class GenericEditor implements EditorPort {
  public constructor(readonly id: EditorId, readonly label: string) {}
  public preparePrompt(job: Readonly<Job>): string { return `${this.label}: rédiger en ${job.language} un article sur « ${job.topic} ».`; }
}
