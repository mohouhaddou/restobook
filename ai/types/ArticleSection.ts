/** Niveau de titre Markdown autorisé pour une section structurée. */
export type ArticleHeadingLevel = 2 | 3 | 4 | 5 | 6;

/** Section logique extraite ou préparée pour le corps d’un article. */
export interface ArticleSection {
  /** Titre de la section. */
  readonly heading: string;
  /** Niveau Markdown du titre, de 2 à 6. */
  readonly level: ArticleHeadingLevel;
  /** Contenu Markdown de la section, hors titre. */
  readonly content: string;
  /** Identifiant d’un `ImageAsset` associé à la section. */
  readonly imageReference?: string;
}
