import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Play, Share2 } from 'lucide-react';
import type { BookItem } from './types';
import ShareButtons from '../../../../shared/components/social/ShareButtons';
import { useKidsRouteLanguage } from '../../../../pages/kids/useKidsRouteLanguage';

export interface BookActionsProps {
  readonly item: BookItem;
  readonly language: string;
  readonly favorite: boolean;
  readonly favoriteLoading?: boolean;
  readonly onToggleFavorite: () => void;
  readonly readTo?: string;
  readonly shareUrl?: string;
  readonly primaryLabel?: string;
  readonly onPrimaryAction?: () => void;
}

/**
 * Barre d'actions du livre — "Lire maintenant" est TOUJOURS l'action principale (bouton plein,
 * en premier), gratuite et jamais liée à un achat. Les produits numériques payants (PDF,
 * audiobook, coloriages, activités...) vivent désormais dans DigitalProductsSection.jsx, plus bas
 * sur la page — une seule architecture générique par type de produit, plus de bouton dédié ici
 * par type (voir le remplacement de BookDownloads/BookAudio/BookColoring/BookActivities.tsx).
 */
export function BookActions({ item, language, favorite, favoriteLoading, onToggleFavorite, readTo, shareUrl, primaryLabel, onPrimaryAction }: BookActionsProps) {
  const { t } = useKidsRouteLanguage();
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="book-actions">
      {onPrimaryAction ? (
        <button type="button" onClick={onPrimaryAction} className="book-action book-action-primary">
          <Play size={18} aria-hidden="true" /> {primaryLabel || t("kids.book.readNow")}
        </button>
      ) : (
        <Link to={readTo || `/kids/${language}/story/${item.slug}`} className="book-action book-action-primary">
          <Play size={18} aria-hidden="true" /> {primaryLabel || t("kids.book.readNow")}
        </Link>
      )}
      <button
        type="button"
        className={`book-action book-action-icon${favorite ? ' is-active' : ''}`}
        onClick={onToggleFavorite}
        disabled={favoriteLoading}
        aria-pressed={favorite}
        aria-label={favorite ? t('kids.book.removeFavorite') : t('kids.book.addFavorite')}
      >
        <Heart size={18} aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} />
      </button>
      <button type="button" className="book-action book-action-icon" onClick={() => setShareOpen(v => !v)} aria-label={t('kids.book.share')} aria-expanded={shareOpen}>
        <Share2 size={18} aria-hidden="true" />
      </button>

      {shareOpen && (
        <div className="book-actions-share">
          <ShareButtons title={item.title} text={item.excerpt} url={shareUrl || `${window.location.origin}/kids/${language}/book/${item.slug}`} compact />
        </div>
      )}
    </div>
  );
}
