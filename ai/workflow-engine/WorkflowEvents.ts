import type { WorkflowContext } from './WorkflowContext';

/** Résultats autorisés pour une étape. */
export const STEP_RESULTS = ['SUCCESS', 'WARNING', 'ERROR', 'SKIPPED'] as const;

/** Résultat terminal d’une étape. */
export type WorkflowStepResultStatus = (typeof STEP_RESULTS)[number];

/** Statuts terminaux d’une exécution complète. */
export type WorkflowReportStatus = 'SUCCESS' | 'WARNING' | 'ERROR';

/** Définition déclarative d’une étape, sans logique exécutable. */
export interface WorkflowStepDefinition {
  /** Identifiant unique de l’étape dans le workflow. */
  readonly id: string;
  /** Nom lisible de l’étape. */
  readonly name: string;
  /** Type de handler attendu, opaque pour le moteur. */
  readonly type: string;
  /** Ordre entier positif d’exécution. */
  readonly order: number;
  /** Permet de désactiver déclarativement une étape. */
  readonly enabled?: boolean;
  /** Configuration opaque transmise au handler. */
  readonly config?: Readonly<Record<string, unknown>>;
}

/** Définition générique et sérialisable d’un workflow. */
export interface WorkflowDefinition {
  /** Identifiant unique du workflow dans le registre. */
  readonly id: string;
  /** Nom lisible du workflow. */
  readonly name: string;
  /** Version sémantique de sa définition. */
  readonly version: string;
  /** Étapes déclaratives du workflow. */
  readonly steps: readonly WorkflowStepDefinition[];
}

/** Valeur retournée par le handler d’une étape. */
export interface WorkflowStepOutcome {
  /** Résultat normalisé de l’étape. */
  readonly status: WorkflowStepResultStatus;
  /** Message synthétique du résultat. */
  readonly message?: string;
  /** Données opaques produites à titre de rapport. */
  readonly output?: unknown;
  /** Avertissements structurés produits par l’étape. */
  readonly warnings?: readonly string[];
  /** Erreurs structurées produites par l’étape. */
  readonly errors?: readonly string[];
}

/** Handler injecté pour un type d’étape. */
export type WorkflowStepHandler<
  TPackage = unknown,
  TMetadata extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> = (
  context: WorkflowContext<TPackage, TMetadata>,
  step: WorkflowStepDefinition,
) => WorkflowStepOutcome | Promise<WorkflowStepOutcome>;

/** Rapport détaillé d’une étape exécutée ou ignorée. */
export interface WorkflowStepReport {
  /** Identifiant de l’étape. */
  readonly stepId: string;
  /** Nom de l’étape. */
  readonly stepName: string;
  /** Type du handler associé. */
  readonly stepType: string;
  /** Résultat terminal. */
  readonly status: WorkflowStepResultStatus;
  /** Date ISO 8601 de début. */
  readonly startedAt: string;
  /** Date ISO 8601 de fin. */
  readonly completedAt: string;
  /** Durée de l’étape en millisecondes. */
  readonly durationMs: number;
  /** Message synthétique. */
  readonly message?: string;
  /** Données opaques retournées. */
  readonly output?: unknown;
  /** Avertissements retournés. */
  readonly warnings: readonly string[];
  /** Erreurs retournées ou capturées. */
  readonly errors: readonly string[];
}

/** Rapport complet d’une exécution de workflow. */
export interface WorkflowExecutionReport {
  /** Identifiant du workflow exécuté. */
  readonly workflowId: string;
  /** Version du workflow exécuté. */
  readonly workflowVersion: string;
  /** Résultat global calculé depuis les rapports d’étapes. */
  readonly status: WorkflowReportStatus;
  /** Date ISO 8601 de début. */
  readonly startedAt: string;
  /** Date ISO 8601 de fin. */
  readonly completedAt: string;
  /** Durée totale en millisecondes. */
  readonly durationMs: number;
  /** Rapports ordonnés de toutes les étapes. */
  readonly steps: readonly WorkflowStepReport[];
  /** Avertissements agrégés. */
  readonly warnings: readonly string[];
  /** Erreurs agrégées. */
  readonly errors: readonly string[];
  /** Journal structuré complet. */
  readonly logs: readonly import('./WorkflowContext').WorkflowLogEntry[];
}

/** Événements observables émis par le moteur. */
export type WorkflowEvent =
  | { readonly type: 'workflow:start'; readonly workflowId: string; readonly timestamp: string }
  | { readonly type: 'workflow:end'; readonly workflowId: string; readonly timestamp: string; readonly status: WorkflowReportStatus }
  | { readonly type: 'step:start'; readonly workflowId: string; readonly stepId: string; readonly timestamp: string }
  | { readonly type: 'step:end'; readonly workflowId: string; readonly stepId: string; readonly timestamp: string; readonly status: WorkflowStepResultStatus };

/** Abonné synchrone à un événement du moteur. */
export type WorkflowEventListener = (event: WorkflowEvent) => void;

/** Bus d’événements minimal, sans dépendance externe. */
export class WorkflowEventBus {
  private readonly listeners = new Set<WorkflowEventListener>();

  /** Enregistre un abonné. */
  on(listener: WorkflowEventListener): () => void {
    this.listeners.add(listener);
    return () => this.off(listener);
  }

  /** Retire un abonné. */
  off(listener: WorkflowEventListener): void {
    this.listeners.delete(listener);
  }

  /** Diffuse un événement à tous les abonnés courants. */
  emit(event: WorkflowEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
