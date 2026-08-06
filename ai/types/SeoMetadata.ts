/** Métadonnées Open Graph destinées aux aperçus sociaux. */
export interface OpenGraphMetadata {
  /** Titre Open Graph. */
  readonly title: string;
  /** Description Open Graph. */
  readonly description: string;
  /** Type Open Graph du document. */
  readonly type: 'article' | 'website';
  /** Chemin relatif ou URL absolue de l’image sociale. */
  readonly image: string;
  /** Nom du site affiché par les plateformes sociales. */
  readonly siteName: string;
}

/** Métadonnées propres aux cartes Twitter/X. */
export interface TwitterMetadata {
  /** Type de carte Twitter/X. */
  readonly card: 'summary' | 'summary_large_image';
  /** Titre de la carte. */
  readonly title: string;
  /** Description de la carte. */
  readonly description: string;
  /** Chemin relatif ou URL absolue de l’image de carte. */
  readonly image: string;
}

/** Métadonnées SEO transportables d’un article. */
export interface SeoMetadata {
  /** Titre proposé pour les moteurs de recherche. */
  readonly title: string;
  /** Description proposée pour les moteurs de recherche. */
  readonly description: string;
  /** URL canonique absolue proposée. */
  readonly canonical: string;
  /** Directive destinée aux robots d’indexation. */
  readonly robots: 'index,follow' | 'noindex,follow' | 'noindex,nofollow';
  /** Configuration Open Graph complète. */
  readonly openGraph: OpenGraphMetadata;
  /** Configuration Twitter/X complète. */
  readonly twitter: TwitterMetadata;
}
