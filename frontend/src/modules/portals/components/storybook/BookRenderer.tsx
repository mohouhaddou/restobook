import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MarkdownTheme } from '../../../../shared/markdown/MarkdownTheme';
import type { PaginatedPage } from './StoryPaginator';
import type { StoryLayoutBox } from './StoryLayoutEngine';
import { BookPage } from './BookPage';
import { navButtonsFor, keyToActionFor, swipeDeltaToAction, slideOffsetFor } from './RTLLayoutManager';

export interface BookRendererProps {
  readonly pages: readonly PaginatedPage[];
  readonly layout: StoryLayoutBox;
  readonly currentIndex: number;
  readonly onNavigate: (index: number) => void;
  readonly theme: MarkdownTheme;
  readonly activeSentenceText?: string | null;
  readonly onStart?: () => void;
  readonly startLabel?: string;
  readonly endContent?: React.ReactNode;
}

/** Seuil de glissement (px) avant de valider un swipe — même convention que
 * frontend/src/shared/hooks/useHeroCarousel.js (déjà utilisé par les carrousels marketplace). */
const SWIPE_THRESHOLD = 60;

function preloadImage(page: PaginatedPage | undefined) {
  const src = page?.image?.src;
  if (src) { const img = new Image(); img.src = src; }
}

/**
 * Un écran = une double page (une illustration + son texte, ou la couverture) — jamais deux pages
 * indépendantes côte à côte : navigation à un seul pas, toujours. Gère la navigation (flèches
 * translucides, swipe, clavier) et précharge l'image de l'écran précédent/suivant pour une
 * lecture sans accroc. Ne prend AUCUNE décision de largeur/orientation/sens de lecture ici — reçoit
 * `layout` déjà résolu (StoryLayoutEngine) et délègue toute la logique RTL (boutons, clavier,
 * swipe, animation) à RTLLayoutManager.ts : ce composant ne teste jamais lui-même `direction`.
 */
export function BookRenderer({ pages, layout, currentIndex, onNavigate, theme, activeSentenceText, onStart, startLabel, endContent }: BookRendererProps) {
  const direction = layout.direction;
  const total = pages.length + (endContent ? 1 : 0);
  const current = Math.max(0, Math.min(currentIndex, Math.max(0, total - 1)));
  const canGoPrev = current > 0;
  const canGoNext = current < total - 1;
  const prevIndex = Math.max(0, current - 1);
  const nextIndex = Math.min(Math.max(0, total - 1), current + 1);

  const goPrev = () => canGoPrev && onNavigate(prevIndex);
  const goNext = () => canGoNext && onNavigate(nextIndex);
  const triggerAction = (action: 'next' | 'prev') => (action === 'next' ? goNext() : goPrev());

  const buttons = navButtonsFor(direction);

  // Sens de la transition en cours (pour l'animation de tourne-page, voir slideOffsetFor) — déduit
  // de la comparaison avec l'index précédent : avancer dans l'HISTOIRE (index qui augmente) est
  // toujours "next" quel que soit le sens de lecture visuel.
  const previousCurrentRef = useRef(current);
  const navigatedTo: 'next' | 'prev' = current >= previousCurrentRef.current ? 'next' : 'prev';
  useEffect(() => { previousCurrentRef.current = current; }, [current]);

  // Clavier — même convention que RestaurantPage.jsx/Game2048.jsx (listener sur window, cleanup).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const action = keyToActionFor(direction, e.key);
      if (!action) return;
      e.preventDefault();
      triggerAction(action);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, total, direction]);

  // Préchargement de l'illustration de l'écran précédent/suivant pour une navigation instantanée.
  useEffect(() => {
    preloadImage(pages[nextIndex]);
    preloadImage(pages[prevIndex]);
  }, [pages, nextIndex, prevIndex]);

  function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const action = swipeDeltaToAction(direction, info.offset.x, SWIPE_THRESHOLD);
    if (action) triggerAction(action);
  }

  const enterOffset = slideOffsetFor(direction, 'enter', navigatedTo);
  const exitOffset = slideOffsetFor(direction, 'exit', navigatedTo);
  const page = pages[current];
  const onEndContent = Boolean(endContent) && current === pages.length;

  return (
    // IMPORTANT : ce div est mesuré tel quel par StoryLayoutEngine (voir BookReader.tsx, le ref
    // est posé sur .storybook-viewport, le parent direct et unique de .storybook-frame) — n'y
    // ajouter aucun frère qui volerait de la largeur/hauteur sous peine de désynchroniser mesure
    // et rendu réel.
    <div className="storybook-frame">
      {page?.kind !== 'cover' && (
        <button
          type="button"
          className="storybook-nav storybook-nav--prev"
          onClick={() => triggerAction(buttons.physicalLeft.action)}
          disabled={buttons.physicalLeft.action === 'next' ? !canGoNext : !canGoPrev}
          aria-label={buttons.physicalLeft.action === 'next' ? 'Page suivante' : 'Page précédente'}
        >
          {buttons.physicalLeft.icon === 'chevron-left' ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
        </button>
      )}

      <motion.div
        className="storybook-pages"
        drag={page?.kind === 'cover' ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={handleDragEnd}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={current}
            className="storybook-screen"
            initial={{ opacity: 0, x: enterOffset }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: exitOffset }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {onEndContent ? endContent : page && (
              <BookPage
                page={page}
                theme={theme}
                pageNumber={current + 1}
                totalPages={total}
                layout={layout}
                activeSentenceText={activeSentenceText}
                onStart={onStart ?? goNext}
                startLabel={startLabel}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {page?.kind !== 'cover' && (
        <button
          type="button"
          className="storybook-nav storybook-nav--next"
          onClick={() => triggerAction(buttons.physicalRight.action)}
          disabled={buttons.physicalRight.action === 'next' ? !canGoNext : !canGoPrev}
          aria-label={buttons.physicalRight.action === 'next' ? 'Page suivante' : 'Page précédente'}
        >
          {buttons.physicalRight.icon === 'chevron-left' ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
        </button>
      )}
    </div>
  );
}
