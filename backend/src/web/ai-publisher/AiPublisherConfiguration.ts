import type { EditorId } from "../../../../ai/types";

/** Configuration immutable du module. */
export interface AiPublisherConfiguration {
  readonly enabledEditors: readonly EditorId[];
  readonly requireImages: boolean;
  readonly maxSeoTitleLength: number;
  readonly maxSeoDescriptionLength: number;
}

export const DEFAULT_AI_PUBLISHER_CONFIGURATION: AiPublisherConfiguration = {
  enabledEditors: ["discover", "sports", "kids", "stories", "gaming"],
  requireImages: true,
  maxSeoTitleLength: 60,
  maxSeoDescriptionLength: 160,
};
