/** Rôles possibles d’une image dans un article. */
export type ImageRole = 'cover' | 'thumbnail' | 'illustration' | 'gallery' | 'social';

/** Formats d’image acceptés par le contrat. */
export type ImageFormat = 'avif' | 'gif' | 'jpeg' | 'png' | 'svg' | 'webp';

/** Image référencée par un article, sans génération ou upload. */
export interface ImageAsset {
  /** Identifiant unique de l’image dans le paquet. */
  readonly id: string;
  /** Nom du fichier avec son extension. */
  readonly filename: string;
  /** Texte alternatif accessible décrivant l’image. */
  readonly alt: string;
  /** Légende éditoriale affichable avec l’image. */
  readonly caption: string;
  /** Usage prévu de l’image dans le contenu. */
  readonly role: ImageRole;
  /** Largeur de l’image en pixels entiers positifs. */
  readonly width: number;
  /** Hauteur de l’image en pixels entiers positifs. */
  readonly height: number;
  /** Format physique du fichier. */
  readonly format: ImageFormat;
  /** Chemin relatif portable sous l’espace média futur. */
  readonly relativePath: string;
  /** Indique si l’image provient d’un futur processus génératif. */
  readonly generated: boolean;
}
