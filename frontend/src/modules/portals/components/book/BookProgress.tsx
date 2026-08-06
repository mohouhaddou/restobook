import React from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { StoryProgress } from '../../hooks/useStoryEngagement';
import { useKidsRouteLanguage } from '../../../../pages/kids/useKidsRouteLanguage';
import { localeForLanguage } from '../../../../pages/kids/i18n';

export interface BookProgressProps {
  readonly slug: string;
  readonly language: string;
  readonly progress: StoryProgress | null;
}

/** Bandeau "Continuer la lecture" — n'apparaît que pour un client connecté ayant déjà une
 * progression enregistrée pour CE livre (voir useStoryProgress) ; invisible pour un invité ou une
 * première visite, jamais un faux "0%". */
export function BookProgress({ slug, language, progress }: BookProgressProps) {
  const { t } = useKidsRouteLanguage();
  if (!progress || progress.completed || progress.totalPages <= 0) return null;
  const percent = Math.round((progress.pageIndex / progress.totalPages) * 100);
  const lastRead = new Date(progress.updatedAt).toLocaleDateString(localeForLanguage(language), { day: 'numeric', month: 'long' });

  return (
    <Link to={`/kids/${language}/story/${slug}`} className="book-progress-banner">
      <div className="book-progress-ring" style={{ '--book-progress': `${percent}%` } as React.CSSProperties}>
        <span>{percent}%</span>
      </div>
      <div className="book-progress-body">
        <strong>{t('kids.book.continueReading')}</strong>
        <span>{t('kids.book.lastReadOn', { date: lastRead })}</span>
      </div>
      <Play size={18} aria-hidden="true" />
    </Link>
  );
}
