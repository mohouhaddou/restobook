import type { ContentPackage } from '../types';
import {
  DEFAULT_PUBLISHER_CONFIGURATION,
  type PublisherConfiguration,
  type PublisherPhaseName,
} from './PublisherConfiguration';
import type { PublisherContext, PublisherContextInput } from './PublisherContext';
import { PublisherValidationError } from './PublisherErrors';
import type { PublisherPhaseHandler } from './PublisherEvents';
import { PublisherPipeline } from './PublisherPipeline';
import type { PublisherReport } from './PublisherReport';
import {
  PublisherValidator,
  type PublisherValidationResult,
} from './PublisherValidator';

/** Entrées d’une exécution Publisher. */
export interface PublisherEngineInput extends Omit<PublisherContextInput, 'configuration'> {
  /** Configuration optionnelle du pipeline. */
  readonly configuration?: PublisherConfiguration;
}

/**
 * Façade indépendante du Publisher Engine.
 *
 * Elle valide un `ContentPackage`, vérifie les handlers puis délègue
 * l’orchestration au pipeline.
 */
export class PublisherEngine<TResult = unknown> {
  constructor(
    readonly validator: PublisherValidator = new PublisherValidator(),
    readonly pipeline: PublisherPipeline<TResult> = new PublisherPipeline<TResult>(),
  ) {}

  /** Enregistre un handler pour une phase canonique. */
  registerPhaseHandler(
    phase: PublisherPhaseName,
    handler: PublisherPhaseHandler<TResult>,
  ): void {
    this.pipeline.registerHandler(phase, handler);
  }

  /** Valide un paquet sans exécuter le pipeline. */
  validate(packageCandidate: unknown): PublisherValidationResult {
    return this.validator.validate(packageCandidate);
  }

  /** Crée un contexte intégralement en mémoire. */
  createContext(input: PublisherEngineInput): PublisherContext<TResult> {
    return {
      package: input.package,
      workspace: input.workspace,
      configuration: input.configuration || DEFAULT_PUBLISHER_CONFIGURATION,
      timestamps: {},
      logs: [],
    };
  }

  /** Valide puis orchestre les phases injectées. */
  async publish(input: PublisherEngineInput): Promise<PublisherReport<TResult>> {
    const validation = this.validate(input.package);
    if (!validation.valid) throw new PublisherValidationError(validation.errors);

    const context = this.createContext(input);
    const missingHandlers = this.pipeline.missingHandlers(context.configuration.phases);
    if (missingHandlers.length > 0) {
      throw new PublisherValidationError(
        missingHandlers.map(phase => `Aucun handler enregistré pour la phase ${phase}.`),
      );
    }
    return this.pipeline.execute(context);
  }
}

/** Vérifie au niveau TypeScript que l’entrée attend bien un paquet canonique. */
export type PublisherContentPackage = ContentPackage;
