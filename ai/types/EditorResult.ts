import type { ContentPackage } from './ContentPackage';
import type { EditorId } from './Metadata';

/** États terminaux possibles d’une exécution éditoriale. */
export type EditorResultStatus = 'ready' | 'review-required' | 'failed';

/** Erreur structurée retournée par un éditeur. */
export interface EditorError {
  /** Code stable de l’erreur. */
  readonly code: string;
  /** Message destiné à la revue ou au diagnostic. */
  readonly message: string;
  /** Propriété concernée, lorsqu’elle est connue. */
  readonly property?: string;
}

/** Résultat sérialisable d’une exécution d’éditeur. */
export interface EditorResult {
  /** Identifiant unique de l’exécution. */
  readonly resultId: string;
  /** Rédaction ayant produit le résultat. */
  readonly editor: EditorId;
  /** État terminal de l’exécution éditoriale. */
  readonly status: EditorResultStatus;
  /** Paquet complet lorsque l’exécution a produit un article. */
  readonly package?: ContentPackage;
  /** Avertissements non bloquants. */
  readonly warnings: readonly string[];
  /** Erreurs structurées constatées. */
  readonly errors: readonly EditorError[];
  /** Date ISO 8601 de création du résultat. */
  readonly createdAt: string;
}
