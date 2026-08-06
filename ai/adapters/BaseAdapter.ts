import type { EditorId } from "../types";
import type {
  IntegrationArtifact,
  IntegrationContext,
  IntegrationReceipt,
} from "../integration/IntegrationContext";
import type { IntegrationValidationResult } from "../integration/IntegrationValidator";

/** Contrat commun que tous les adapters iFilino doivent implémenter. */
export interface IntegrationAdapter {
  readonly id: EditorId;
  readonly targetProduct: string;
  validate(context: IntegrationContext): IntegrationValidationResult;
  prepare(context: IntegrationContext): IntegrationArtifact;
  rollback(receipt: IntegrationReceipt, rolledBackAt: string): IntegrationReceipt;
}

/** Implémentation contractuelle commune, sans dépendance à un backend. */
export abstract class BaseAdapter implements IntegrationAdapter {
  public abstract readonly id: EditorId;
  public abstract readonly targetProduct: string;

  public validate(context: IntegrationContext): IntegrationValidationResult {
    const errors = context.package.editor === this.id
      ? []
      : [`Le package ${context.package.id} ne cible pas ${this.id}.`];
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  public prepare(context: IntegrationContext): IntegrationArtifact {
    return {
      integrationId: context.integrationId,
      adapterId: this.id,
      packageId: context.package.id,
      targetProduct: this.targetProduct,
      content: structuredClone(context.package),
      assets: structuredClone(context.assets),
      preparedAt: context.createdAt,
    };
  }

  public rollback(
    receipt: IntegrationReceipt,
    rolledBackAt: string,
  ): IntegrationReceipt {
    return { ...structuredClone(receipt), status: "ROLLED_BACK", rolledBackAt };
  }
}
