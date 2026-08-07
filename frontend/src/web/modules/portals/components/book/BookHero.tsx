import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Clock, FileText, Globe2, Headphones, Palette, Sparkles } from 'lucide-react';
import type { BookItem } from './types';
import { BookActions, type BookActionsProps } from './BookActions';
import { fadeUp } from './bookMotion';
import { useKidsRouteLanguage } from '../../../../pages/kids/useKidsRouteLanguage';

export interface BookHeroProps extends Omit<BookActionsProps, 'item'> {
  readonly item: BookItem;
  readonly contentLabel?: string;
  readonly badges?: readonly string[];
}

const SUMMARY_LINE_CLAMP = 6;

/**
 * Hero premium de la page de présentation d'un livre : grande couverture + titre/sous-titre/
 * badges/résumé/actions. Aucune décision desktop/mobile ici — le CSS (book.css) bascule seul de
 * "couverture à gauche, infos à droite" à "couverture puis infos empilées" selon la largeur.
 */
export function BookHero({ item, contentLabel, badges, ...actionsProps }: BookHeroProps) {
  const { t } = useKidsRouteLanguage();
  const [expanded, setExpanded] = useState(false);
  const meta = item.metadata || {};
  const summary = item.excerpt || '';
  const summaryLines = summary.split(/\n+/).filter(Boolean);
  const isLong = summaryLines.length > SUMMARY_LINE_CLAMP || summary.length > 420;
  // Langues réellement disponibles (traductions publiées, voir portalContentService.getContentBySlug
  // côté backend) — plus fiable que l'ancien `metadata.languages` (JSON libre saisi par l'éditeur,
  // pouvait diverger des traductions réellement publiées).
  const availableLanguages = item.available_languages?.length ? item.available_languages : ['fr'];
  const languagesLabel = availableLanguages.map(code => t(`kids.book.lang.${code}`) || code).join(' · ');

  return (
    <section className="book-hero">
      <motion.div className="book-hero-cover" initial="hidden" animate="visible" variants={fadeUp}>
        {item.image_url
          ? <img src={item.image_url} alt={item.title + ' cover illustration'} width="1200" height="675" fetchPriority="high" decoding="async" />
          : <span className="book-hero-cover-placeholder" aria-hidden="true"><BookOpen size={48} /></span>}
      </motion.div>

      <motion.div className="book-hero-content" initial="hidden" animate="visible" variants={fadeUp}>
        <span className="book-hero-kicker"><Sparkles size={14} aria-hidden="true" /> {contentLabel || t('kids.book.illustratedAlbum')}</span>
        <h1 className="book-hero-title">{item.title}</h1>
        {meta.subtitle && <p className="book-hero-subtitle">{meta.subtitle}</p>}

        <ul className="book-hero-badges">
          <li><BookOpen size={15} aria-hidden="true" /> {contentLabel || t("kids.book.illustratedAlbum")}</li>
          {badges?.filter(Boolean).map(badge => <li key={badge}>{badge}</li>)}
          {meta.ageRange && <li>{meta.ageRange}</li>}
          {meta.readingMinutes ? <li><Clock size={15} aria-hidden="true" /> {meta.readingMinutes} min</li> : null}
          {meta.pageCount ? <li><FileText size={15} aria-hidden="true" /> {meta.pageCount} pages</li> : null}
          <li><Globe2 size={15} aria-hidden="true" /> {languagesLabel}</li>
          {meta.audio && <li className="book-hero-badge-live"><Headphones size={15} aria-hidden="true" /> {t('kids.book.audioAvailable')}</li>}
          {meta.coloringPack && <li className="book-hero-badge-live"><Palette size={15} aria-hidden="true" /> {t('kids.book.coloringAvailable')}</li>}
          {meta.pdf && <li className="book-hero-badge-live"><FileText size={15} aria-hidden="true" /> {t('kids.book.pdfAvailable')}</li>}
        </ul>

        {summary && (
          <div className="book-hero-summary">
            <p className={expanded ? '' : 'is-clamped'}>{summary}</p>
            {isLong && (
              <button type="button" className="book-hero-summary-toggle" onClick={() => setExpanded(v => !v)}>
                {expanded ? t('kids.book.showLess') : t('kids.book.showMore')}
              </button>
            )}
          </div>
        )}

        <BookActions item={item} {...actionsProps} />
      </motion.div>
    </section>
  );
}
