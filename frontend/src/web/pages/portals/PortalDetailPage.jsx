import React, { useMemo, useRef } from 'react';
import { ArrowLeft, CalendarDays, Eye } from 'lucide-react';
import { Link, Navigate, useParams } from "react-router-dom";
import { useI18n } from '../../../i18n/config';
import { PortalBrand } from '../../modules/portals/components/PortalBrand';
import { PortalFooter } from '../../modules/portals/components/PortalFooter';
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer';
import { parseMarkdownBlocks } from '../../markdown/MarkdownParser';
import { ThemeResolver } from '../../markdown/ThemeResolver';
import { usePortalItem } from '../../modules/portals/hooks/usePortalItem';
import { usePortalContents } from "../../modules/portals/hooks/usePortalContents";
import { useStoryFavorite } from "../../modules/portals/hooks/useStoryEngagement";
import { BookHero } from "../../modules/portals/components/book/BookHero";
import { BookMetadata } from "../../modules/portals/components/book/BookMetadata";
import { BookRecommendations } from "../../modules/portals/components/book/BookRecommendations";
import { DigitalProductsSection } from "../../modules/portals/digitalProducts/DigitalProductsSection";
import PremiumPreviewNotice from '../../modules/portals/components/freemium/PremiumPreviewNotice';
import { EncyclopediaReader } from '../../modules/portals/components/encyclopedia/EncyclopediaReader';
import { useFullscreen } from '../../modules/portals/components/storybook/useFullscreen';
import { useKidsRouteLanguage } from '../kids/useKidsRouteLanguage';
import { localeForLanguage } from '../kids/i18n';
import "../../modules/portals/portals.css";
import "../../modules/portals/components/book/book.css";

export default function PortalDetailPage({ portal, reader = false }) {
  const { slug } = useParams();
  const { language: uiLanguage, t: uiT, formatDate: uiFormatDate, formatNumber: uiFormatNumber } = useI18n();
  const { language: kidsLanguage, t: kidsT } = useKidsRouteLanguage({ enabled: portal === 'kids' });
  const language = portal === 'kids' ? kidsLanguage : uiLanguage;
  const t = portal === 'kids' ? kidsT : uiT;
  const kidsLocale = localeForLanguage(language);
  const formatDate = portal === 'kids' ? (value, options) => new Intl.DateTimeFormat(kidsLocale, options || { dateStyle: 'medium' }).format(new Date(value)) : uiFormatDate;
  const formatNumber = portal === 'kids' ? (value, options) => new Intl.NumberFormat(kidsLocale, options).format(Number(value || 0)) : uiFormatNumber;
  const state = usePortalItem(portal, slug, language);
  const item = state.item;
  const { favorite, loading: favoriteLoading, toggleFavorite } = useStoryFavorite(portal, slug);
  const relatedState = usePortalContents(portal, language, item?.type);
  const related = useMemo(() => relatedState.items.filter(candidate => candidate.slug !== item?.slug).slice(0, 8), [relatedState.items, item?.slug]);
  const readerModeRef = useRef(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(readerModeRef);

  const isStory = portal === 'kids' && item?.type === 'stories';
  // Tout contenu Kids non-Story (Nature/Animals/Space/Science/History/...) est désormais lu
  // plein écran via EncyclopediaReader/AdventureBookEngine, même route qu'avant
  // (/kids/:lang/content/:slug — voir le plan "Unify the Educational Reader with the Storybook
  // engine", contrainte explicite de conserver le routage existant), juste un rendu différent une
  // fois le contenu chargé. Sports garde exactement son ancien rendu scrollable, inchangé.
  const isEncyclopedia = portal === 'kids' && Boolean(item) && !isStory;

  const blocks = useMemo(() => parseMarkdownBlocks(item?.blocks), [item]);
  const portalHome = portal === 'kids' ? `/kids/${language}` : `/${portal}`;

  // Une histoire Kids ne s'ouvre plus jamais directement en lecture : elle a désormais sa propre
  // page de présentation (voir BookLandingPage.jsx). Un ancien lien direct vers /kids/content/:slug
  // (partagé, mis en favori...) atterrit donc sur cette nouvelle étape plutôt que sur le lecteur —
  // c'est le nouveau parcours voulu, pas une régression : Bibliothèque → présentation → lecture.
  if (isStory && !state.loading && !state.error && item) {
    return <Navigate to={`/kids/${language}/book/${slug}`} replace />;
  }

  if (isEncyclopedia && reader) {
    return (
      <div ref={readerModeRef} className="portal portal-kids portal-story-mode">
        <main className="story-reader-viewport">
          <div className="story-reader-body">
            {state.loading ? (
              <div className="portal-detail-skeleton" aria-busy="true"><span/><span/><span/><span/></div>
            ) : state.missingLanguage ? (
              <div className="portal-empty" role="alert">
                <strong>{t('portals.error.missingLanguage')}</strong>
                {state.availableLanguages.length > 0 && (
                  <p>{Object.entries(state.languageUrls).map(([lng, url]) => <Link key={lng} to={url} className="portal-back">{lng.toUpperCase()}</Link>)}</p>
                )}
              </div>
            ) : state.error || !item ? (
              <div className="portal-empty" role="alert"><strong>{t('portals.error.title')}</strong><p>{t('portals.error.description')}</p></div>
            ) : (
              <>
                <PremiumPreviewNotice item={item} language={language}/>
                <EncyclopediaReader
                  item={item} blocks={blocks} t={t}
                  backTo={portalHome} backLabel={t('portals.back')}
                  isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen}
                />
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (isEncyclopedia) {
    const sectionLabel = t(`kids.nav.${item.type}`);
    return (
      <div className="portal portal-kids book-landing">
        <header className="portal-header"><div className="portal-shell portal-header-row"><PortalBrand portal="kids"/></div></header>
        <main className="portal-shell book-landing-main">
          <nav className="book-breadcrumb" aria-label={t("portals.breadcrumb")}>
            <Link to={portalHome}><ArrowLeft size={16}/> {t("portals.back")}</Link><span>/</span>
            <Link to={`/kids/${language}/${item.type}`}>{sectionLabel}</Link>
            <span>/</span><span aria-current="page">{item.title}</span>
          </nav>
          {state.loading ? <div className="portal-detail-skeleton" aria-busy="true"><span/><span/><span/><span/></div> : state.error || !item ? (
            <div className="portal-empty" role="alert"><strong>{t("portals.error.title")}</strong><p>{t("portals.error.description")}</p></div>
          ) : <>
            <PremiumPreviewNotice item={item} language={language}/>
            <BookHero item={item} language={language} contentLabel={sectionLabel} favorite={favorite} favoriteLoading={favoriteLoading} onToggleFavorite={toggleFavorite} readTo={`/kids/${language}/read/${item.slug}`}/>
            <BookMetadata item={item} language={language}/>
            <DigitalProductsSection portalContentId={item.id}/>
            <BookRecommendations books={related} language={language} title={language === "fr" ? "Sujets similaires" : language === "ar" ? "محتويات مشابهة" : "Similar content"} hrefFor={candidate => `/kids/${language}/content/${candidate.slug}`}/>
          </>}
        </main>
        <PortalFooter portal="kids" language={language}/>
      </div>
    );
  }

  return (
    <div className={`portal portal-${portal}`}>
      <header className="portal-header"><div className="portal-shell portal-header-row"><PortalBrand portal={portal}/></div></header>
      <main className="portal-shell portal-detail">
        <Link className="portal-back" to={portalHome}><ArrowLeft size={18}/>{t('portals.back')}</Link>
        {state.loading ? <div className="portal-detail-skeleton" aria-busy="true"><span/><span/><span/><span/></div> : state.missingLanguage ? (
          <div className="portal-empty" role="alert">
            <strong>{t('portals.error.missingLanguage')}</strong>
            {state.availableLanguages.length > 0 && (
              <p>{Object.entries(state.languageUrls).map(([lng, url]) => <Link key={lng} to={url} className="portal-back">{lng.toUpperCase()}</Link>)}</p>
            )}
          </div>
        ) : state.error || !item ? (
          <div className="portal-empty" role="alert"><strong>{t('portals.error.title')}</strong><p>{t('portals.error.description')}</p></div>
        ) : (
          <article>
            <PremiumPreviewNotice item={item} language={language}/>
            <span className="portal-kicker">{t(`${portal}.nav.${item.type}`)}</span>
            <h1>{item.title}</h1>
            <div className="portal-detail-meta">
              {item.published_at && <span><CalendarDays size={17}/>{formatDate(item.published_at)}</span>}
              <span><Eye size={17}/>{formatNumber(item.view_count)}</span>
            </div>
            {item.image_url && <img className="portal-detail-image" src={item.image_url} alt=""/>}
            {item.excerpt && <p className="portal-detail-lead">{item.excerpt}</p>}
            <MarkdownRenderer blocks={blocks} theme={ThemeResolver.resolve(portal)} />
          </article>
        )}
      </main>
      <PortalFooter portal={portal}/>
    </div>
  );
}
