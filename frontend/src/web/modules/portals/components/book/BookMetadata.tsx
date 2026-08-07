import React from 'react';
import { motion } from 'framer-motion';
import type { BookItem } from './types';
import { fadeUp, staggerContainer } from './bookMotion';
import { useKidsRouteLanguage } from '../../../../pages/kids/useKidsRouteLanguage';
import { localeForLanguage } from '../../../../pages/kids/i18n';

export interface BookMetadataProps {
  readonly item: BookItem;
  readonly language: string;
}

function formatMinutes(minutes: number | undefined): string | null {
  if (!minutes) return null;
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim();
}

/** Fiche technique du livre — chaque ligne n'apparaît que si la donnée existe réellement. */
export function BookMetadata({ item, language }: BookMetadataProps) {
  const { t } = useKidsRouteLanguage();
  const locale = localeForLanguage(language);
  const meta = item.metadata || {};
  const availableLanguages = item.available_languages?.length ? item.available_languages : undefined;
  const rows: Array<{ label: string; value: string | number }> = [
    { label: t('kids.book.author'), value: meta.author ?? '' },
    { label: t('kids.book.illustrator'), value: meta.illustrator ?? '' },
    { label: t('kids.book.narrator'), value: meta.narrator ?? '' },
    { label: t('kids.book.translator'), value: meta.translator ?? '' },
    { label: t('kids.book.availableLanguages'), value: availableLanguages ? availableLanguages.map(code => t(`kids.book.lang.${code}`) || code).join(', ') : '' },
    { label: t('kids.book.ageRange'), value: meta.ageRange ?? '' },
    { label: t('kids.book.pageCount'), value: meta.pageCount ?? '' },
    { label: t('kids.book.illustrationCount'), value: meta.illustrationCount ?? '' },
    { label: t('kids.book.wordCount'), value: meta.wordCount ? meta.wordCount.toLocaleString(locale) : '' },
    { label: t('kids.book.readingTime'), value: formatMinutes(meta.readingMinutes) ?? '' },
    { label: 'ISBN', value: meta.isbn ?? '' },
    { label: 'Version', value: meta.version ?? '' },
    { label: t('kids.book.lastUpdated'), value: item.published_at ? new Date(item.published_at).toLocaleDateString(locale) : '' },
    { label: meta.licence ? 'Licence' : '', value: meta.licence ?? '' },
  ].filter(row => row.value !== '');

  if (!rows.length) return null;

  return (
    <section className="book-section book-metadata">
      <h2>{t('kids.book.info')}</h2>
      <motion.dl className="book-metadata-grid" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={staggerContainer}>
        {rows.map(row => (
          <motion.div key={row.label} className="book-metadata-row" variants={fadeUp}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </motion.div>
        ))}
      </motion.dl>
    </section>
  );
}
