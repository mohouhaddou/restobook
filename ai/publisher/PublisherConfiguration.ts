/** Phases canoniques du pipeline de publication. */
export const PUBLISHER_PHASES = [
  'Validate',
  'Normalize',
  'PrepareImages',
  'PrepareMarkdown',
  'PrepareMetadata',
  'Package',
  'Finalize',
] as const;

/** Nom fortement typé d’une phase du Publisher. */
export type PublisherPhaseName = (typeof PUBLISHER_PHASES)[number];

/** Configuration déclarative d’une phase. */
export interface PublisherPhaseConfiguration {
  /** Nom canonique de la phase. */
  readonly name: PublisherPhaseName;
  /** Ordre entier positif d’exécution. */
  readonly order: number;
  /** Permet à l’appelant de désactiver la phase. */
  readonly enabled: boolean;
}

/** Configuration complète et indépendante d’une exécution Publisher. */
export interface PublisherConfiguration {
  /** Version sémantique de la configuration. */
  readonly version: string;
  /** Phases du pipeline et leur ordre. */
  readonly phases: readonly PublisherPhaseConfiguration[];
  /** Arrête les handlers suivants dès le premier résultat `ERROR`. */
  readonly stopOnError: boolean;
}

/** Configuration canonique, sans comportement métier. */
export const DEFAULT_PUBLISHER_CONFIGURATION: PublisherConfiguration = {
  version: '1.0.0',
  stopOnError: true,
  phases: PUBLISHER_PHASES.map((name, index) => ({
    name,
    order: index + 1,
    enabled: true,
  })),
};
