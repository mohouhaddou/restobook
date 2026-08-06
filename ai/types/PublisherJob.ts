/** Priorités acceptées par la future file de publication. */
export type PublisherJobPriority = 'low' | 'normal' | 'high' | 'urgent';

/** États descriptifs d’un travail de publication. */
export type PublisherJobStatus = 'incoming' | 'processing' | 'published' | 'failed';

/** Erreur sérialisable associée à un futur travail de publication. */
export interface PublisherJobError {
  /** Code stable de l’erreur. */
  readonly code: string;
  /** Message de diagnostic lisible. */
  readonly message: string;
  /** Date ISO 8601 de survenue. */
  readonly occurredAt: string;
}

/** Description d’un travail destiné au futur Publisher. */
export interface PublisherJob {
  /** Identifiant unique du travail. */
  readonly jobId: string;
  /** Identifiant du `ContentPackage` concerné. */
  readonly packageId: string;
  /** Priorité déclarée du travail. */
  readonly priority: PublisherJobPriority;
  /** État courant du travail dans la file. */
  readonly status: PublisherJobStatus;
  /** Date ISO 8601 de création du travail. */
  readonly createdAt: string;
  /** Date ISO 8601 de dernière modification du travail. */
  readonly updatedAt: string;
  /** Historique immuable des erreurs connues. */
  readonly errors: readonly PublisherJobError[];
}
