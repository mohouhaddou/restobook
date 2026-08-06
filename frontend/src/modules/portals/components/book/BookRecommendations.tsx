import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { fadeUp, staggerContainer } from './bookMotion';
import { useKidsRouteLanguage } from '../../../../pages/kids/useKidsRouteLanguage';

export interface RecommendedBook {
  readonly slug: string;
  readonly title: string;
  readonly image_url?: string;
  readonly excerpt?: string;
}

export interface BookRecommendationsProps {
  readonly books: readonly RecommendedBook[];
  readonly language: string;
  readonly title?: string;
  readonly hrefFor?: (book: RecommendedBook) => string;
}

/** Carrousel "Histoires similaires" — présentationnel uniquement : la sélection (recommandations
 * éditoriales via metadata.recommendedBooks, ou repli par catégorie) est calculée en amont par
 * BookLandingPage, pas ici, pour rester une simple liste réutilisable ailleurs si besoin. */
export function BookRecommendations({ books, language, title, hrefFor }: BookRecommendationsProps) {
  const { t } = useKidsRouteLanguage();
  if (!books.length) return null;

  return (
    <section className="book-section book-recommendations">
      <h2>{title || t("kids.book.similarStories")}</h2>
      <motion.div className="book-recommendations-rail" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={staggerContainer}>
        {books.map(book => (
          <motion.div key={book.slug} variants={fadeUp}>
            <Link to={hrefFor ? hrefFor(book) : `/kids/${language}/book/${book.slug}`} className="book-recommendation-card">
              <span className="book-recommendation-media">
                {book.image_url
                  ? <img src={book.image_url} alt="" loading="lazy" />
                  : <span className="book-recommendation-placeholder" aria-hidden="true"><BookOpen size={22} /></span>}
              </span>
              <strong>{book.title}</strong>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
