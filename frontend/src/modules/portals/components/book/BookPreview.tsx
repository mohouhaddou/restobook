import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { BookItem } from './types';
import { fadeUp, staggerContainer } from './bookMotion';
import { useKidsRouteLanguage } from '../../../../pages/kids/useKidsRouteLanguage';

export interface BookPreviewProps {
  readonly item: BookItem;
}

/** Aperçu de quelques pages — miniatures cliquables, ouverture dans une visionneuse plein écran
 * avec navigation entre les pages d'aperçu (jamais le livre entier : seul un aperçu). */
export function BookPreview({ item }: BookPreviewProps) {
  const { t } = useKidsRouteLanguage();
  const pages = item.metadata?.previewPages || [];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenIndex(null);
      if (e.key === 'ArrowRight') setOpenIndex(i => (i === null ? i : Math.min(pages.length - 1, i + 1)));
      if (e.key === 'ArrowLeft') setOpenIndex(i => (i === null ? i : Math.max(0, i - 1)));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openIndex, pages.length]);

  if (!pages.length) return null;

  return (
    <section className="book-section book-preview">
      <h2>{t('kids.book.preview')}</h2>
      <motion.div className="book-preview-grid" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={staggerContainer}>
        {pages.map((preview, index) => (
          <motion.button
            type="button"
            key={preview.page}
            className="book-preview-thumb"
            variants={fadeUp}
            onClick={() => setOpenIndex(index)}
            aria-label={t('kids.book.openPage', { page: preview.page })}
          >
            <img src={preview.image} alt={t('kids.book.page', { page: preview.page })} loading="lazy" />
            <span>{t('kids.book.page', { page: preview.page })}</span>
          </motion.button>
        ))}
      </motion.div>

      {openIndex !== null && (
        <div className="book-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setOpenIndex(null)}>
          <div className="book-preview-viewer" onClick={e => e.stopPropagation()}>
            <button type="button" className="book-modal-close" onClick={() => setOpenIndex(null)} aria-label={t('kids.book.close')}><X size={18} /></button>
            <img src={pages[openIndex].image} alt={`Page ${pages[openIndex].page}`} />
            <div className="book-preview-viewer-nav">
              <button type="button" onClick={() => setOpenIndex(i => Math.max(0, (i ?? 0) - 1))} disabled={openIndex === 0} aria-label={t('kids.book.previousPage')}>
                <ChevronLeft size={20} />
              </button>
              <span>{t('kids.book.page', { page: pages[openIndex].page })}</span>
              <button type="button" onClick={() => setOpenIndex(i => Math.min(pages.length - 1, (i ?? 0) + 1))} disabled={openIndex === pages.length - 1} aria-label={t('kids.book.nextPage')}>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
