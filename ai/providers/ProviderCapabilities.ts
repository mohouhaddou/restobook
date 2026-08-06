import type { ContentLanguage, EditorId } from "../types/Metadata";

export interface ProviderCapabilities {
  readonly text: boolean;
  readonly images: boolean;
  readonly metadata: boolean;
  readonly languages: readonly ContentLanguage[];
  readonly editors: readonly EditorId[];
  readonly maxContextTokens: number;
}

export const DEFAULT_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  text: true, images: false, metadata: true,
  languages: ["fr", "ar", "en"],
  editors: ["discover", "sports", "kids", "stories", "gaming"],
  maxContextTokens: 128_000,
};
