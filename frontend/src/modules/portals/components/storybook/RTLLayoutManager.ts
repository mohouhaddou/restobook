/**
 * Toutes les décisions liées au sens de lecture (LTR/RTL) vivent ICI, et nulle part ailleurs —
 * indépendant du renderer (pure logique, aucun JSX/DOM). BookRenderer.tsx/ScenePage.tsx
 * l'utilisent, mais aucun ne teste `language === 'ar'` lui-même : ajouter une future langue RTL
 * (hébreu, persan...) ne demandera de modifier que ce fichier.
 */
export type ReadingDirection = 'ltr' | 'rtl';

/** Langues déjà connues du Narration Engine (voir narration/LanguageDetector.ts) — l'arabe est la
 * seule RTL à ce jour. */
export function directionForLanguage(language: string): ReadingDirection {
  return language === 'ar' ? 'rtl' : 'ltr';
}

/** Chaque écran est une double page UNIQUE (une illustration + son texte, jamais deux pages
 * indépendantes côte à côte) : LTR = illustration à GAUCHE / texte à DROITE ; RTL = inversé
 * (illustration à droite / texte à gauche) — schéma explicite du chantier. */
export function imageSideFor(direction: ReadingDirection): 'left' | 'right' {
  return direction === 'rtl' ? 'right' : 'left';
}

export interface NavAction {
  readonly action: 'next' | 'prev';
  readonly icon: 'chevron-left' | 'chevron-right';
}

/**
 * Quel bouton physique (rendu à gauche vs à droite de l'écran) déclenche "avancer dans
 * l'histoire" vs "reculer" — en LTR le bouton de GAUCHE recule et celui de DROITE avance (lecture
 * naturelle) ; en RTL c'est l'inverse ("Suivant ←, Précédent →" demandé explicitement), pour que
 * le geste reste cohérent avec le sens de lecture plutôt qu'avec la position à l'écran.
 */
export function navButtonsFor(direction: ReadingDirection): { physicalLeft: NavAction; physicalRight: NavAction } {
  if (direction === 'rtl') {
    return {
      physicalLeft: { action: 'next', icon: 'chevron-left' },
      physicalRight: { action: 'prev', icon: 'chevron-right' },
    };
  }
  return {
    physicalLeft: { action: 'prev', icon: 'chevron-left' },
    physicalRight: { action: 'next', icon: 'chevron-right' },
  };
}

/** Touches clavier — même principe que les boutons : la flèche qui "avance" dans l'histoire suit
 * le sens de lecture, pas une convention universelle gauche=recule. */
export function keyToActionFor(direction: ReadingDirection, key: string): 'next' | 'prev' | null {
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null;
  const buttons = navButtonsFor(direction);
  return key === 'ArrowLeft' ? buttons.physicalLeft.action : buttons.physicalRight.action;
}

/** Glissement tactile — un swipe est un geste physique (vers la gauche/droite de l'écran), sa
 * signification narrative (avancer/reculer) suit la même règle que les boutons. */
export function swipeDeltaToAction(direction: ReadingDirection, deltaX: number, threshold: number): 'next' | 'prev' | null {
  if (deltaX <= -threshold) return direction === 'rtl' ? 'prev' : 'next';
  if (deltaX >= threshold) return direction === 'rtl' ? 'next' : 'prev';
  return null;
}

/** Décalage horizontal (px, direction du signe) pour l'animation d'entrée/sortie d'une nouvelle
 * page — la page entrante vient du côté "vers lequel on avance" et sort vers le côté "d'où l'on
 * vient", mêmes animations existantes (opacité/échelle), juste le sens du glissement qui
 * s'inverse en RTL pour rester cohérent avec le sens de lecture. */
export function slideOffsetFor(direction: ReadingDirection, kind: 'enter' | 'exit', navigatedTo: 'next' | 'prev'): number {
  const SLIDE_PX = 28;
  // LTR + next : la nouvelle page vient de la droite (offset positif en entrée), sort vers la
  // gauche. RTL inverse ce rapport (la lecture avance vers la gauche).
  const forwardSign = direction === 'rtl' ? -1 : 1;
  const navSign = navigatedTo === 'next' ? 1 : -1;
  const sign = forwardSign * navSign;
  return kind === 'enter' ? sign * SLIDE_PX : -sign * SLIDE_PX;
}
