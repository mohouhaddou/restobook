import type { EditorId } from "../../../../ai/types";

/** Résultat stable d'une publication atomique réussie. */
export interface PublishResult {
  readonly operationId: string;
  readonly packageId: string;
  readonly editor: EditorId;
  readonly target: string;
  readonly recordId: string;
  readonly publishedAt: string;
}
