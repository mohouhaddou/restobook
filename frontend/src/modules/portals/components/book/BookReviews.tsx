import React from 'react';
import { Star } from 'lucide-react';
import type { BookItem } from './types';
import { useKidsRouteLanguage } from '../../../../pages/kids/useKidsRouteLanguage';
import { localeForLanguage } from '../../../../pages/kids/i18n';

export interface BookReviewsProps {
  readonly item: BookItem;
  readonly language: string;
}

function StarRow({ rating }: { rating: number }) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <span className="book-star-row" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} fill={i < full ? 'currentColor' : 'none'} />)}
    </span>
  );
}

/** Note + avis — le module de notation/modération de RestoBook aujourd'hui est scopé aux fiches
 * commerces, pas au contenu de portail : cette section lit `metadata.rating`/`metadata.reviews`
 * (voir le contrat documenté dans serializer.js), prête à être branchée sur un vrai système d'avis
 * dédié aux livres le jour venu, sans rien changer côté page. */
export function BookReviews({ item, language }: BookReviewsProps) {
  const { t } = useKidsRouteLanguage();
  const locale = localeForLanguage(language);
  const rating = item.metadata?.rating;
  const reviews = item.metadata?.reviews || [];
  const average = rating?.average ?? 0;
  const count = rating?.count ?? 0;

  return (
    <section className="book-section book-reviews">
      <h2>{t('kids.book.reviews')}</h2>
      <div className="book-reviews-summary">
        {average > 0 ? (
          <>
            <strong>{average.toFixed(1)}</strong>
            <div>
              <StarRow rating={average} />
              <span>{t('kids.book.reviewsCount', { count })}</span>
            </div>
          </>
        ) : (
          <span className="book-reviews-new">{t('kids.book.noReviewsYet')}</span>
        )}
      </div>
      {!!reviews.length && (
        <ul className="book-reviews-list">
          {reviews.map((review, index) => (
            <li key={index}>
              <div className="book-review-head">
                <strong>{review.author}</strong>
                <StarRow rating={review.rating} />
                {review.date && <span>{new Date(review.date).toLocaleDateString(locale)}</span>}
              </div>
              {review.comment && <p>{review.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
