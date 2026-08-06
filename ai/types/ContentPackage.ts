import type { ArticleSection } from './ArticleSection';
import type { ImageAsset } from './ImageAsset';
import type { ContentLanguage, EditorId, Metadata } from './Metadata';
import type { SeoMetadata } from './SeoMetadata';
import type { Workflow } from './Workflow';

/** États possibles d’un paquet dans son cycle éditorial. */
export type ContentPackageStatus = 'draft' | 'review' | 'approved' | 'queued' | 'published' | 'failed';

/**
 * Contrat canonique représentant un article complet produit par une rédaction.
 * Il est indépendant des modèles des produits iFilino.
 */
export interface ContentPackage {
  /** Identifiant global, unique et immuable du paquet. */
  readonly id: string;
  /** Rédaction ayant produit le paquet. */
  readonly editor: EditorId;
  /** Catégorie éditoriale principale. */
  readonly category: string;
  /** Langue principale de l’article. */
  readonly language: ContentLanguage;
  /** Date ISO 8601 de création du paquet. */
  readonly createdAt: string;
  /** Date ISO 8601 de dernière modification du paquet. */
  readonly updatedAt: string;
  /** Article complet au format Markdown. */
  readonly articleMarkdown: string;
  /** Sections structurées correspondant au corps de l’article. */
  readonly sections: readonly ArticleSection[];
  /** Métadonnées éditoriales complètes. */
  readonly metadata: Metadata;
  /** Images référencées par le contenu. */
  readonly images: readonly ImageAsset[];
  /** Métadonnées SEO et sociales. */
  readonly seo: SeoMetadata;
  /** Workflow ayant conduit à la production du paquet. */
  readonly workflow: Workflow;
  /** Version sémantique du contrat utilisée par le paquet. */
  readonly version: string;
  /** État éditorial courant du paquet. */
  readonly status: ContentPackageStatus;
}
