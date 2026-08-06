import type { WorkflowStepDefinition } from './WorkflowEvents';

/** Niveau d’une entrée de journal du moteur. */
export type WorkflowLogLevel = 'info' | 'warning' | 'error';

/** Type d’événement journalisé pendant l’exécution. */
export type WorkflowLogEvent =
  | 'workflow:start'
  | 'workflow:end'
  | 'step:start'
  | 'step:end'
  | 'warning'
  | 'error'
  | 'result';

/** Entrée structurée du journal d’exécution. */
export interface WorkflowLogEntry {
  /** Date ISO 8601 de l’événement. */
  readonly timestamp: string;
  /** Niveau de sévérité de l’entrée. */
  readonly level: WorkflowLogLevel;
  /** Type stable de l’événement. */
  readonly event: WorkflowLogEvent;
  /** Message lisible associé à l’événement. */
  readonly message: string;
  /** Identifiant d’étape concerné, le cas échéant. */
  readonly stepId?: string;
  /** Données structurées complémentaires. */
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Horodatages du workflow et de l’étape courante. */
export interface WorkflowTimestamps {
  /** Début ISO 8601 du workflow. */
  startedAt?: string;
  /** Fin ISO 8601 du workflow. */
  completedAt?: string;
  /** Début ISO 8601 de l’étape courante. */
  currentStepStartedAt?: string;
  /** Fin ISO 8601 de la dernière étape terminée. */
  lastStepCompletedAt?: string;
}

/** Valeur initiale utilisée lorsque le moteur ne reçoit aucune métadonnée. */
export type EmptyWorkflowMetadata = Readonly<Record<string, unknown>>;

/**
 * Contexte mutable partagé entre les étapes d’une même exécution.
 *
 * Les types de paquet et de métadonnées sont génériques afin que le moteur ne
 * connaisse aucun éditeur ni contrat métier particulier.
 */
export interface WorkflowContext<
  TPackage = unknown,
  TMetadata = EmptyWorkflowMetadata,
> {
  /** Définition de l’étape en cours, ou `undefined` avant/après exécution. */
  currentStep?: WorkflowStepDefinition;
  /** Identifiant libre de l’éditeur appelant, opaque pour le moteur. */
  editor: string;
  /** Répertoire de travail fourni par l’appelant. */
  workingDirectory: string;
  /** Paquet opaque transporté entre les étapes. */
  package?: TPackage;
  /** Métadonnées opaques transportées entre les étapes. */
  metadata: TMetadata;
  /** Journal structuré alimenté par `WorkflowLogger`. */
  logs: WorkflowLogEntry[];
  /** Horodatages de l’exécution. */
  timestamps: WorkflowTimestamps;
}

/** Données minimales nécessaires à la création d’un contexte. */
export interface WorkflowContextInput<
  TPackage = unknown,
  TMetadata = EmptyWorkflowMetadata,
> {
  /** Identifiant libre de l’éditeur appelant. */
  readonly editor: string;
  /** Répertoire de travail fourni par l’appelant. */
  readonly workingDirectory: string;
  /** Paquet initial opaque et optionnel. */
  readonly package?: TPackage;
  /** Métadonnées initiales opaques. */
  readonly metadata: TMetadata;
}

/** Construit un contexte vide de tout état d’exécution. */
export function createWorkflowContext<
  TPackage = unknown,
  TMetadata = EmptyWorkflowMetadata,
>(input: WorkflowContextInput<TPackage, TMetadata>): WorkflowContext<TPackage, TMetadata> {
  return {
    editor: input.editor,
    workingDirectory: input.workingDirectory,
    package: input.package,
    metadata: input.metadata,
    logs: [],
    timestamps: {},
  };
}
