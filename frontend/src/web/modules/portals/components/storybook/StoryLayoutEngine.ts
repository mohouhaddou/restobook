import { useEffect, useState, type RefObject } from 'react';
import { directionForLanguage, type ReadingDirection } from './RTLLayoutManager';

export type StoryLayoutMode = 'single' | 'spread';

/**
 * Ce module fait aussi office de "ResponsiveBookLayout" : le layout résolu dépend de la taille
 * RÉELLE du cadre lecteur (responsive) ET de la langue (RTL) — les deux informations dont a
 * besoin BookSpreadBuilder.ts pour construire un vrai livre ouvert cohérent. Un seul point de
 * résolution plutôt que deux modules qui se chevaucheraient.
 */
export interface StoryLayoutBox {
  /** 'single' = une page plein écran (mobile, tablette portrait) ; 'spread' = livre ouvert à deux pages (desktop, tablette paysage). */
  readonly mode: StoryLayoutMode;
  readonly columns: 1 | 2;
  /** Taille du cadre lecteur complet (les deux pages + reliure éventuelle). */
  readonly width: number;
  readonly height: number;
  /** Taille d'UNE page (la moitié du cadre en mode spread). */
  readonly pageWidth: number;
  readonly pageHeight: number;
  /** Sens de lecture — dérivé de la langue de l'histoire (voir RTLLayoutManager.ts), jamais de
   * l'UI du site. Pilote l'ordre visuel gauche/droite (BookSpreadBuilder.ts), la navigation et
   * les animations (BookRenderer.tsx) — jamais la pagination elle-même. */
  readonly direction: ReadingDirection;
}

const EMPTY_BOX: StoryLayoutBox = { mode: 'single', columns: 1, width: 0, height: 0, pageWidth: 0, pageHeight: 0, direction: 'ltr' };

/** Largeur minimale pour un livre ouvert — alignée sur le seuil déjà utilisé par portals.css (900px). */
const SPREAD_MIN_WIDTH = 900;

/**
 * Seule pièce du système qui décide "desktop / tablette paysage / tablette portrait / mobile".
 * Le mode dépend de la largeur ET de l'orientation du cadre lecteur lui-même (pas de la fenêtre
 * entière) : une tablette en paysage devient un livre ouvert, la même tablette en portrait
 * repasse en page unique — c'est pour ça qu'on compare width/height du conteneur, pas un simple
 * media query sur la fenêtre.
 */
export function resolveStoryLayout(width: number, height: number, language = 'fr'): StoryLayoutBox {
  const direction = directionForLanguage(language);
  if (width <= 0 || height <= 0) return { ...EMPTY_BOX, direction };
  const isLandscape = width >= height;
  const mode: StoryLayoutMode = width >= SPREAD_MIN_WIDTH && isLandscape ? 'spread' : 'single';
  const columns = mode === 'spread' ? 2 : 1;
  // Aucune reliure/goutière visuelle à soustraire (voir storybook.css) : les deux pages se
  // touchent directement, comme un écran divisé en deux, pas un livre relié.
  const pageWidth = mode === 'spread' ? width / columns : width;
  return { mode, columns, width, height, pageWidth, pageHeight: height, direction };
}

/** Mesure en continu le conteneur du lecteur (ResizeObserver) et renvoie le layout résolu — inclut
 * la direction de lecture (voir `language`), donc recalculé aussi quand la langue détectée change
 * (nouvelle histoire), pas seulement au redimensionnement/à la rotation. */
export function useStoryLayout(containerRef: RefObject<HTMLElement | null>, language = 'fr'): StoryLayoutBox {
  const [box, setBox] = useState<StoryLayoutBox>(() => ({ ...EMPTY_BOX, direction: directionForLanguage(language) }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBox(prev => {
        const next = resolveStoryLayout(rect.width, rect.height, language);
        if (prev.mode === next.mode && prev.width === next.width && prev.height === next.height && prev.direction === next.direction) return prev;
        return next;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, language]);

  return box;
}
