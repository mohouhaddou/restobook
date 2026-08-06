/**
 * Contrat d'un thème de rendu Markdown. Un thème ne contient AUCUNE logique de
 * parsing/rendu — uniquement des classes CSS et quelques icônes. MarkdownRenderer
 * et MarkdownComponents ne connaissent jamais le module (discover/sports/kids...),
 * seulement l'objet `theme` qu'on leur passe.
 */

export type CalloutKind = 'tip' | 'info' | 'warning' | 'note';

export interface MarkdownThemeClasses {
  readonly container: string;
  readonly heading1: string;
  readonly heading2: string;
  readonly heading3: string;
  readonly paragraph: string;
  readonly image: string;
  readonly table: string;
  readonly tableWrapper: string;
  readonly quote: string;
  readonly callout: string;
  readonly code: string;
  readonly list: string;
  readonly faq: string;
}

export interface MarkdownTheme {
  /** Identifiant unique — c'est la clé utilisée par ThemeRegistry/ThemeResolver. */
  readonly id: string;
  /** Nom lisible (rapports, debug). */
  readonly label: string;
  readonly classes: MarkdownThemeClasses;
  /** Libellé affiché pour chaque type de callout (peut être surchargé par thème). */
  readonly calloutLabels?: Partial<Record<CalloutKind, string>>;
  /** Discover n'affichait pas de légende sous ses images avant ce moteur — désactivé pour rester visuellement identique. */
  readonly showImageCaption?: boolean;
}
