import type { ContentPackage, EditorId } from "../types";
import type { ResolvedAsset } from "./AssetResolver";

/** Contexte immutable transmis à un adapter, sans service backend. */
export interface IntegrationContext {
  readonly integrationId: string;
  readonly adapterId: EditorId;
  readonly package: ContentPackage;
  readonly assets: readonly ResolvedAsset[];
  readonly targetProduct: string;
  readonly createdAt: string;
}

/** Artefact préparé par un adapter. Il ne représente pas une publication. */
export interface IntegrationArtifact {
  readonly integrationId: string;
  readonly adapterId: EditorId;
  readonly packageId: string;
  readonly targetProduct: string;
  readonly content: ContentPackage;
  readonly assets: readonly ResolvedAsset[];
  readonly preparedAt: string;
}

/** Reçu en mémoire utilisé pour suivre et annuler une préparation. */
export interface IntegrationReceipt {
  readonly id: string;
  readonly artifact: IntegrationArtifact;
  readonly status: "PREPARED" | "ROLLED_BACK";
  readonly rolledBackAt?: string;
}
