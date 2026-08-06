import React, { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PortalBrand } from '../../modules/portals/components/PortalBrand';
import { PortalFooter } from '../../modules/portals/components/PortalFooter';
import { usePortalItem } from '../../modules/portals/hooks/usePortalItem';
import { usePortalContents } from '../../modules/portals/hooks/usePortalContents';
import { useStoryFavorite, useStoryProgress } from '../../modules/portals/hooks/useStoryEngagement';
import { BookSeo } from '../../modules/portals/components/book/BookSeo';
import PremiumPreviewNotice from '../../modules/portals/components/freemium/PremiumPreviewNotice';
import { BookHero } from '../../modules/portals/components/book/BookHero';
import { BookProgress } from '../../modules/portals/components/book/BookProgress';
import { BookPreview } from '../../modules/portals/components/book/BookPreview';
import { BookCharacters } from '../../modules/portals/components/book/BookCharacters';
import { BookLearningGoals } from '../../modules/portals/components/book/BookLearningGoals';
import { BookMetadata } from '../../modules/portals/components/book/BookMetadata';
import { DigitalProductsSection } from '../../modules/portals/digitalProducts/DigitalProductsSection';
import { BookProducts } from '../../modules/portals/components/book/BookProducts';
import { BookRecommendations } from '../../modules/portals/components/book/BookRecommendations';
import { BookReviews } from '../../modules/portals/components/book/BookReviews';
import StoryMediaSection from '../../modules/media/StoryMediaSection';
import { useKidsRouteLanguage } from '../kids/useKidsRouteLanguage';
import '../../modules/portals/portals.css';
import '../../modules/portals/components/book/book.css';

const MAX_RECOMMENDATIONS = 8;

export default function BookLandingPage() {
  const { slug } = useParams();
  const { language, t } = useKidsRouteLanguage();
  // manageSeo: false — BookSeo (ci-dessous) pilote déjà titre/OG/Twitter/JSON-LD en entier,
  // avec un format plus riche que le repli générique du hook (voir usePortalItem.js).
  const { loading, item, error } = usePortalItem('kids', slug, language, { manageSeo: false });
  const { favorite, loading: favoriteLoading, toggleFavorite } = useStoryFavorite('kids', slug);
  const { progress } = useStoryProgress('kids', slug);

  // Recommandations : priorité aux slugs choisis éditorialement (metadata.recommendedBooks),
  // repli sur les autres histoires de la même catégorie — jamais de nouvel appel réseau dédié,
  // on réutilise la liste "stories" déjà chargée par la bibliothèque (usePortalContents).
  const storiesData = usePortalContents('kids', language, 'stories');
  const recommendations = useMemo(() => {
    if (!item) return [];
    const pool = storiesData.items.filter(candidate => candidate.slug !== item.slug);
    const recommendedSlugs = item.metadata?.recommendedBooks;
    if (recommendedSlugs?.length) {
      const bySlug = new Map(pool.map(candidate => [candidate.slug, candidate]));
      const curated = recommendedSlugs.map(s => bySlug.get(s)).filter(Boolean);
      if (curated.length) return curated.slice(0, MAX_RECOMMENDATIONS);
    }
    const sameCategory = item.category ? pool.filter(candidate => candidate.category === item.category) : [];
    return (sameCategory.length ? sameCategory : pool).slice(0, MAX_RECOMMENDATIONS);
  }, [item, storiesData.items]);

  return (
    <div className="portal portal-kids book-landing">
      <BookSeo item={item} language={language} t={t} />
      <header className="portal-header">
        <div className="portal-shell portal-header-row"><PortalBrand portal="kids" /></div>
      </header>

      <main className="portal-shell book-landing-main">
        <nav className="book-breadcrumb" aria-label={t('portals.breadcrumb')}>
          <Link to={`/kids/${language}`}><ArrowLeft size={16} aria-hidden="true" /> {t('portals.back')}</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/kids/${language}/stories`}>{t('kids.nav.stories')}</Link>
          {item && <><span aria-hidden="true">/</span><span aria-current="page">{item.title}</span></>}
        </nav>

        {loading ? (
          <div className="portal-detail-skeleton" aria-busy="true"><span/><span/><span/><span/></div>
        ) : error || !item ? (
          <div className="portal-empty" role="alert"><strong>{t('portals.error.title')}</strong><p>{t('portals.error.description')}</p></div>
        ) : (
          <>
            <BookProgress slug={slug} language={language} progress={progress} />
            <PremiumPreviewNotice item={item} language={language}/>
            <BookHero item={item} language={language} favorite={favorite} favoriteLoading={favoriteLoading} onToggleFavorite={toggleFavorite} />
            <BookPreview item={item} />
            <BookCharacters item={item} />
            <BookLearningGoals item={item} />
            <BookMetadata item={item} language={language} />
            <StoryMediaSection story={item} />
            <DigitalProductsSection portalContentId={item.id} />
            <BookProducts item={item} />
            <BookRecommendations books={recommendations} language={language} />
            <BookReviews item={item} language={language} />
          </>
        )}
      </main>
      <PortalFooter portal="kids" language={language} />
    </div>
  );
}
