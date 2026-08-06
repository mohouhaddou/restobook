import type { EditorId } from './Metadata';

/** État déclaratif d’une étape de workflow. */
export type WorkflowStepStatus = 'pending' | 'completed' | 'skipped' | 'failed';

/** Étape descriptive et sérialisable d’un workflow éditorial. */
export interface WorkflowStep {
  /** Identifiant stable de l’étape dans le workflow. */
  readonly id: string;
  /** Nom lisible de l’étape. */
  readonly name: string;
  /** Position entière positive de l’étape dans la séquence. */
  readonly order: number;
  /** État courant de l’étape. */
  readonly status: WorkflowStepStatus;
  /** Indique si une validation humaine est requise à cette étape. */
  readonly requiresHumanReview: boolean;
}

/** Workflow suivi par l’éditeur pour produire le paquet. */
export interface Workflow {
  /** Rédaction propriétaire du workflow. */
  readonly editor: EditorId;
  /** Étapes ordonnées constituant le workflow. */
  readonly steps: readonly WorkflowStep[];
  /** Version sémantique de la définition du workflow. */
  readonly version: string;
}
