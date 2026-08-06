/** Erreur sérialisable incluse dans un rapport de publication. */
export interface PublishError {
  readonly code: string;
  readonly message: string;
  readonly phase: "validation" | "preparation" | "transaction" | "publication";
}
