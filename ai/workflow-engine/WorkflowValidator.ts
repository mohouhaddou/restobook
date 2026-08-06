import type { WorkflowDefinition, WorkflowStepDefinition } from './WorkflowEvents';

/** Rapport détaillé d’une validation de workflow. */
export interface WorkflowValidationResult {
  /** Indique si la définition respecte entièrement le contrat. */
  readonly valid: boolean;
  /** Erreurs bloquantes détectées. */
  readonly errors: readonly string[];
  /** Avertissements non bloquants détectés. */
  readonly warnings: readonly string[];
}

/** Prédicat optionnel permettant de contrôler les types d’étapes disponibles. */
export type WorkflowStepTypePredicate = (stepType: string) => boolean;

/** Validation structurelle générique des définitions de workflows. */
export class WorkflowValidator {
  /** Valide une valeur inconnue sans exécuter ses étapes. */
  validate(
    candidate: unknown,
    supportsStepType?: WorkflowStepTypePredicate,
  ): WorkflowValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.isRecord(candidate)) {
      return { valid: false, errors: ['Le workflow doit être un objet.'], warnings };
    }

    this.requireNonEmptyString(candidate.id, 'id', errors);
    this.requireNonEmptyString(candidate.name, 'name', errors);
    if (typeof candidate.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(candidate.version)) {
      errors.push('version doit respecter le format sémantique x.y.z.');
    }

    if (!Array.isArray(candidate.steps) || candidate.steps.length === 0) {
      errors.push('steps doit contenir au moins une étape.');
      return { valid: false, errors, warnings };
    }

    const ids = new Set<string>();
    const orders = new Set<number>();
    for (const [index, rawStep] of candidate.steps.entries()) {
      const prefix = `steps[${index}]`;
      if (!this.isRecord(rawStep)) {
        errors.push(`${prefix} doit être un objet.`);
        continue;
      }
      this.validateStep(rawStep, prefix, ids, orders, errors, supportsStepType);
    }

    const sortedOrders = [...orders].sort((left, right) => left - right);
    sortedOrders.forEach((order, index) => {
      if (order !== index + 1) errors.push('L’ordre des étapes doit être continu et commencer à 1.');
    });

    const declaredOrders = candidate.steps
      .filter(this.isRecord)
      .map(step => step.order);
    const ordered = declaredOrders.every((order, index) => index === 0 || Number(order) > Number(declaredOrders[index - 1]));
    if (!ordered) warnings.push('Les étapes seront exécutées selon `order`, indépendamment de leur position dans le tableau.');

    return { valid: errors.length === 0, errors, warnings };
  }

  /** Garde de type réutilisable après une validation réussie. */
  isWorkflowDefinition(candidate: unknown): candidate is WorkflowDefinition {
    return this.validate(candidate).valid;
  }

  private validateStep(
    step: Record<string, unknown>,
    prefix: string,
    ids: Set<string>,
    orders: Set<number>,
    errors: string[],
    supportsStepType?: WorkflowStepTypePredicate,
  ): void {
    this.requireNonEmptyString(step.id, `${prefix}.id`, errors);
    this.requireNonEmptyString(step.name, `${prefix}.name`, errors);
    this.requireNonEmptyString(step.type, `${prefix}.type`, errors);

    if (typeof step.id === 'string' && step.id.trim()) {
      if (ids.has(step.id)) errors.push(`${prefix}.id doit être unique.`);
      ids.add(step.id);
    }
    if (!Number.isInteger(step.order) || Number(step.order) < 1) {
      errors.push(`${prefix}.order doit être un entier positif.`);
    } else {
      const order = Number(step.order);
      if (orders.has(order)) errors.push(`${prefix}.order doit être unique.`);
      orders.add(order);
    }
    if (step.enabled !== undefined && typeof step.enabled !== 'boolean') {
      errors.push(`${prefix}.enabled doit être un booléen.`);
    }
    if (step.config !== undefined && !this.isRecord(step.config)) {
      errors.push(`${prefix}.config doit être un objet.`);
    }
    if (typeof step.type === 'string' && supportsStepType && !supportsStepType(step.type)) {
      errors.push(`${prefix}.type n’est associé à aucun handler compatible.`);
    }
  }

  private requireNonEmptyString(value: unknown, property: string, errors: string[]): void {
    if (typeof value !== 'string' || !value.trim()) errors.push(`${property} doit être une chaîne non vide.`);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
