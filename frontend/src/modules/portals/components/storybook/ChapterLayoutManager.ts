import type { Block } from '../../../../shared/markdown/MarkdownParser';

/**
 * Règle "un chapitre commence toujours en haut d'une nouvelle page" — extraite de StoryPaginator.ts
 * en un module nommé et testable indépendamment, comme demandé. Un bloc `heading` marque un début
 * de chapitre, exactement comme partout ailleurs dans le Narration Engine (SpeechExtractor.ts
 * traite chaque heading comme un marqueur de chapitre pour le menu "reprendre depuis…" côté
 * NarrationBar) — cohérence délibérée avec cette définition déjà établie, pas une redéfinition
 * locale du mot "chapitre".
 */
export function startsChapter(block: Block): boolean {
  return block.type === 'heading';
}

/**
 * true si ce bloc doit forcer la fermeture de la page en cours AVANT d'y être ajouté — c'est-à-
 * dire : c'est un titre de chapitre ET la page en cours contient déjà quelque chose. Un chapitre
 * ne doit JAMAIS commencer au milieu d'une page, même s'il y aurait techniquement la place pour
 * lui ET la suite : il attend toujours une page neuve.
 *
 * Le cas "titre resté seul si rien ne suit ne tient sur la même page" est géré séparément par le
 * mécanisme de report déjà en place dans StoryPaginator.ts (closeCurrent) : un titre qui se
 * retrouve seul en train de fermer sa page est reporté avec le contenu suivant, jamais laissé
 * orphelin — sauf en toute fin d'histoire (cas limite accepté, rien ne suit de toute façon).
 */
export function shouldForceNewPageBefore(block: Block, currentPageHasContent: boolean): boolean {
  return startsChapter(block) && currentPageHasContent;
}
