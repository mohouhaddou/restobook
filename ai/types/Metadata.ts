/** Identifiants des rédactions reconnues par le contrat commun. */
export type EditorId = 'discover' | 'sports' | 'kids' | 'stories' | 'gaming' | 'nature' | 'animals' | 'space' | 'science' | 'study';

/** Codes de langue acceptés par le contrat éditorial initial. */
export type ContentLanguage = 'fr' | 'ar' | 'en';

/** Difficulté de lecture ou niveau de technicité annoncé. */
export type ContentDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** Référence documentaire utilisée pour préparer ou vérifier un article. */
export interface ContentSource {
  /** Nom lisible de la source. */
  readonly title: string;
  /** Adresse absolue de la source. */
  readonly url: string;
  /** Nom de l’éditeur ou de l’organisme source, lorsqu’il est connu. */
  readonly publisher?: string;
  /** Date ISO 8601 de publication de la source, lorsqu’elle est connue. */
  readonly publishedAt?: string;
  /** Date ISO 8601 de consultation de la source. */
  readonly accessedAt: string;
}

/** Auteur déclaré du contenu éditorial. */
export interface ContentAuthor {
  /** Nom affiché de l’auteur ou de la rédaction. */
  readonly name: string;
  /** Type d’auteur permettant de distinguer une personne d’une rédaction. */
  readonly type: 'person' | 'organization' | 'ai-editor';
  /** Identifiant interne stable, sans dépendance à une base de données. */
  readonly id?: string;
}

/** Informations de licence et d’attribution du contenu. */
export interface ContentLicense {
  /** Identifiant ou nom lisible de la licence. */
  readonly name: string;
  /** URL décrivant les conditions de la licence. */
  readonly url?: string;
  /** Mention d’attribution devant accompagner le contenu. */
  readonly attribution?: string;
}

/** Métadonnées éditoriales portables d’un article. */
export interface Metadata {
  /** Titre éditorial principal. */
  readonly title: string;
  /** Identifiant lisible destiné aux URL. */
  readonly slug: string;
  /** Résumé court utilisé dans les listes et cartes. */
  readonly excerpt: string;
  /** Description éditoriale plus complète du contenu. */
  readonly description: string;
  /** Expressions importantes pour la recherche et le classement. */
  readonly keywords: readonly string[];
  /** Étiquettes éditoriales associées au contenu. */
  readonly tags: readonly string[];
  /** Auteur ou rédaction responsable du contenu. */
  readonly author: ContentAuthor;
  /** Catégorie éditoriale canonique. */
  readonly category: string;
  /** Langue principale du contenu. */
  readonly language: ContentLanguage;
  /** Temps de lecture estimé en minutes entières positives. */
  readonly readingTime: number;
  /** Niveau de difficulté ou de technicité. */
  readonly difficulty: ContentDifficulty;
  /** Sources documentaires déclarées. */
  readonly sources: readonly ContentSource[];
  /** Licence applicable au contenu. */
  readonly license: ContentLicense;
}
