import React, { useEffect, useMemo, useState } from 'react';
import { Menu, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useI18n } from '../../../i18n/config';
import { PORTAL_CONFIG } from '../../modules/portals/config';
import { PortalBrand } from '../../modules/portals/components/PortalBrand';
import { PortalCard } from '../../modules/portals/components/PortalCard';
import { PortalSkeleton } from '../../modules/portals/components/PortalSkeleton';
import { PortalFooter } from '../../modules/portals/components/PortalFooter';
import { usePortalContents } from '../../modules/portals/hooks/usePortalContents';
import { getKidsCardComponent } from '../../modules/portals/components/cards';
import { PortalHeroCarousel } from '../../components/portalHero/PortalHeroCarousel';
import { useCustomerAuth } from '../../../shared/context/CustomerAuthContext';
import { useKidsRouteLanguage } from '../kids/useKidsRouteLanguage';
import TaxonomySidebar from '../../modules/kids-taxonomy/PremiumTaxonomySidebar';
import ContentRail from '../../modules/kids-taxonomy/ContentRail';
import KidsPremiumHome from '../kids/KidsPremiumHome';
import SeoHead, { kidsAlternates } from '../../../shared/seo/SeoHead';
import { findTaxonomyItem, localizedLabel, taxonomyFor } from '../../modules/kids-taxonomy/taxonomyConfig';
import { filterByTaxonomy } from '../../modules/kids-taxonomy/taxonomyEngine';
import '../../modules/portals/portals.css';
import '../../modules/portals/components/cards/kids-cards.css';

const RAIL_COPY = {
  fr: { results: 'Résultats', featured: 'À la une', popular: 'Les plus populaires', latest: 'Nouveautés', discover: 'À découvrir' },
  en: { results: 'Results', featured: 'Featured', popular: 'Most popular', latest: 'Recently added', discover: 'Discover' },
  ar: { results: 'النتائج', featured: 'مختارات', popular: 'الأكثر شعبية', latest: 'أضيف حديثاً', discover: 'استكشف' },
};

export default function PortalPage({ portal }) {
  const { section = '', taxonomy = '' } = useParams();
  const { language: uiLanguage, t: uiT } = useI18n();
  // Kids : la langue du contenu ET du chrome (nav/boutons/libellés) vient de la route
  // (/kids/:lang/...), jamais du contexte i18n global — Sports n'est pas concerné par cette
  // migration et garde la langue globale du site.
  const { language: kidsLanguage, t: kidsT } = useKidsRouteLanguage({ enabled: portal === 'kids' });
  const language = portal === 'kids' ? kidsLanguage : uiLanguage;
  const t = portal === 'kids' ? kidsT : uiT;
  const { user, token } = useCustomerAuth();
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState({ sort: 'newest' });

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [sidebarOpen]);
  const config = PORTAL_CONFIG[portal];
  const portalRoot = portal === 'kids' ? `/kids/${language}` : config.root;
  const taxonomyConfig = portal === 'kids' ? taxonomyFor(section) : null;
  const contentType = taxonomyConfig?.contentType || section;
  const criterion = taxonomyConfig ? findTaxonomyItem(section, taxonomy) : null;
  const validSection = !section || config.nav.some(([key]) => key === section);
  const validTaxonomy = !taxonomy || Boolean(criterion);
  const dataSection = portal === "kids" && taxonomy === "search" ? "" : contentType;
  const data = usePortalContents(portal, language, dataSection);
  const allItems = useMemo(
    () => dataSection ? data.items : Object.values(data.sections).flat(),
    [data.items, data.sections, dataSection],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(language);
    let result = taxonomyConfig ? filterByTaxonomy(allItems, criterion, query) : allItems.filter(item => !normalized || (String(item.title || "") + " " + String(item.excerpt || "")).toLocaleLowerCase(language).includes(normalized));
    if (filters.language) result = result.filter(item => item.language === filters.language);
    if (filters.age) result = result.filter(item => String(item.age || item.metadata?.ageRange || item.metadata?.age || "").includes(filters.age));
    if (filters.difficulty) result = result.filter(item => (item.difficulty || item.metadata?.difficulty) === filters.difficulty);
    if (filters.premium) result = result.filter(item => Boolean(item.premium || item.metadata?.premium));
    if (filters.duration) result = result.filter(item => {
      const minutes = Number(item.estimatedDurationMinutes || item.metadata?.duration || item.metadata?.readingMinutes);
      return filters.duration === "short" ? minutes < 10 : filters.duration === "medium" ? minutes >= 10 && minutes <= 40 : minutes > 40;
    });
    return [...result].sort((x, y) => filters.sort === "alphabetical" ? (x.title || "").localeCompare(y.title || "", language) : filters.sort === "popular" ? Number(y.view_count || 0) - Number(x.view_count || 0) : new Date(y.published_at || 0) - new Date(x.published_at || 0));
  }, [allItems, query, language, taxonomyConfig, criterion, filters]);

  const railCopy = RAIL_COPY[language] || RAIL_COPY.en;
  const pageLabel = criterion ? localizedLabel(criterion.label, language) : section ? t("kids.nav." + section) : "";
  const kidsSeo = portal === "kids" && section ? {
    title: pageLabel + " — Stories, Activities & Learning | iFilino Kids",
    description: language === "fr" ? "Découvrez " + pageLabel.toLowerCase() + " : contenus éducatifs, histoires et activités pour enfants sur iFilino Kids." : language === "ar" ? "اكتشف " + pageLabel + ": محتوى تعليمي وقصص وأنشطة للأطفال على iFilino Kids." : "Explore " + pageLabel.toLowerCase() + ": educational content, stories and activities for children on iFilino Kids.",
    suffix: [section, taxonomy].filter(Boolean).join("/"),
  } : null;
  const libraryCollections = useMemo(() => {
    if (!taxonomyConfig) return [];
    if (taxonomy || query.trim() || filters.age || filters.difficulty || filters.premium || filters.duration) {
      if (taxonomy === 'search') {
        const grouped = new Map();
        filtered.forEach(item => { const key = item.subject || item.category || item.type || railCopy.results; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(item); });
        return [...grouped].map(([title, items]) => ({ title, items }));
      }
      return [{ title: criterion ? localizedLabel(criterion.label, language) : railCopy.results, items: filtered }];
    }
    const latest = [...filtered].sort((a,b) => new Date(b.published_at || 0)-new Date(a.published_at || 0));
    const groups = new Map();
    filtered.forEach(item => { const key = item.subject || item.category; if (key) { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); } });
    return [
      { title: railCopy.featured, items: filtered.filter(item => item.featured).slice(0,12) },
      { title: railCopy.popular, items: [...filtered].sort((a,b) => Number(b.view_count || 0)-Number(a.view_count || 0)).slice(0,12) },
      { title: railCopy.latest, items: latest.slice(0,12) },
      ...[...groups].slice(0,8).map(([title, items]) => ({ title, items })),
    ].filter(collection => collection.items.length);
  }, [taxonomyConfig, taxonomy, query, filters, filtered, criterion, language, railCopy]);

  if (portal === "kids" && !section) return <KidsPremiumHome language={language} t={t} user={user} token={token} data={data}/>;
  if (!validSection || !validTaxonomy) return <Navigate to={section ? `${portalRoot}/${section}` : portalRoot} replace/>;
  const featured = filtered.find(item => item.featured) || filtered[0];
  const rest = featured ? filtered.filter(item => item.id !== featured.id) : filtered;

  return (
    <div className={`portal portal-${portal} portal-listing`}>
      {kidsSeo && <SeoHead title={kidsSeo.title} description={kidsSeo.description} canonicalPath={"/kids/" + language + "/" + kidsSeo.suffix} language={language} alternates={kidsAlternates(kidsSeo.suffix)}/>}
      <header className="portal-header">
        <div className="portal-shell portal-header-row">
          <PortalBrand portal={portal}/>
          {portal === 'kids' && <button type="button" className="portal-sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-expanded={sidebarOpen} aria-controls="kids-topics-sidebar" aria-label={t('kids.topics')}><Menu size={22} aria-hidden="true"/></button>}
          <nav className="portal-nav" aria-label={t(`${portal}.nav.label`)}>
            <Link className={!section ? 'active' : ''} to={portalRoot}>{t(`${portal}.nav.home`)}</Link>
            {config.nav.slice(0, 7).map(([key, Icon]) => (
              <Link className={section === key ? 'active' : ''} key={key} to={`${portalRoot}/${key}`}>
                <Icon size={17}/><span>{t(`${portal}.nav.${key}`)}</span>
              </Link>
            ))}
          </nav>
          {portal === 'kids' && (
            <Link className="portal-header-auth" to={user ? `/kids/${language}/profile` : `/kids/${language}/login`}>
              {user ? (user.nom || t('kids.auth.myAccount')) : t('kids.auth.tabs.login')}
            </Link>
          )}
        </div>
      </header>

      <main>
        <section className="portal-hero">
          <PortalHeroCarousel portal={portal}/>
          <div className="portal-shell portal-hero-grid">
            <div>
              <span className="portal-kicker">{t(`${portal}.hero.kicker`)}</span>
              <h1>{criterion ? localizedLabel(criterion.label, language) : section ? t(`${portal}.nav.${section}`) : t(`${portal}.hero.title`)}</h1>
              <p>{section ? t(`${portal}.section.description`) : t(`${portal}.hero.subtitle`)}</p>
            </div>
            <div className="portal-search">
              <label htmlFor={`${portal}-search`}>{t('portals.search')}</label>
              <div><Search size={19}/><input id={`${portal}-search`} value={query} onChange={event => setQuery(event.target.value)} placeholder={t(`${portal}.search.placeholder`)}/></div>
            </div>
          </div>
        </section>

        <section id="portal-main-content" tabIndex={-1} className={`portal-shell portal-content${portal === "kids" || !section ? " portal-content-with-sidebar" : ""}${taxonomyConfig ? " taxonomy-layout" : ""}`}>
          {taxonomyConfig && <TaxonomySidebar config={taxonomyConfig} items={allItems} activeSlug={taxonomy} language={language} basePath={`${portalRoot}/${section}`} open={sidebarOpen} onClose={() => setSidebarOpen(false)} filters={filters} onFiltersChange={setFilters}/>}
          {!taxonomyConfig && portal === 'kids' && sidebarOpen && <button type="button" className="portal-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label={t('kids.topics')}/>}
          {!taxonomyConfig && (portal === 'kids' || !section) && (
            <aside id={portal === 'kids' ? 'kids-topics-sidebar' : undefined} className={`portal-topics${sidebarOpen ? ' is-open' : ''}`} aria-label={t(`${portal}.topics`)}>
              {portal === 'kids' && <div className="portal-topics-mobile-head"><strong>{t('kids.topics')}</strong><button type="button" onClick={() => setSidebarOpen(false)} aria-label={t('kids.topics')}><X size={22} aria-hidden="true"/></button></div>}
              {config.nav.map(([key, Icon]) => (
                <Link className={section === key ? 'active' : ''} key={key} to={`${portalRoot}/${key}`} onClick={() => setSidebarOpen(false)}><Icon size={20}/><span>{t(`${portal}.nav.${key}`)}</span></Link>
              ))}
            </aside>
          )}
          <div className={taxonomyConfig ? 'taxonomy-main' : undefined}>
          <div className="portal-section-heading">
            <div><span>{t(`${portal}.latest.kicker`)}</span><h2>{criterion ? localizedLabel(criterion.label, language) : section ? t(`${portal}.nav.${section}`) : t(`${portal}.latest.title`)}</h2></div>
            <SlidersHorizontal size={21} aria-hidden="true"/>
          </div>
          {data.loading ? <PortalSkeleton/> : data.error ? (
            <div className="portal-empty" role="alert"><strong>{t('portals.error.title')}</strong><p>{t('portals.error.description')}</p></div>
          ) : filtered.length === 0 ? (
            <div className="portal-empty"><strong>{t('portals.empty.title')}</strong><p>{t('portals.empty.description')}</p></div>
          ) : taxonomyConfig ? (
            <div className={`kids-streaming-collections${taxonomy === "featured" ? " is-featured" : ""}`}>{libraryCollections.map((collection, index) => <ContentRail key={`${collection.title}-${index}`} id={`kids-rail-${section}-${index}`} title={collection.title} items={collection.items} language={language}/>)}</div>
          ) : (
            <>
              {featured && (() => { const FeaturedCard = portal === 'kids' ? getKidsCardComponent(featured.type) : PortalCard; return <FeaturedCard portal={portal} item={featured} language={language} featured/>; })()}
              <div className="portal-grid">{rest.map(item => { const CardComponent = portal === 'kids' ? getKidsCardComponent(item.type) : PortalCard; return <CardComponent key={item.id} portal={portal} item={item} language={language}/>; })}</div>
            </>
          )}
          </div>
        </section>
      </main>
      <PortalFooter portal={portal} language={language}/>
    </div>
  );
}
