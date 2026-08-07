import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API } from '../../../api';
import { useCart } from '../../../contexts/CartContext';
import { ProductCard } from '../../../market/components/marketplace/ProductCard';
import { Toast } from '../../../shared/components/ui/Toast';
import MagazineSidebar from './magazine/MagazineSidebar';
import MagazineHeader from './magazine/MagazineHeader';
import { MagazineFooter, MagazineNavbar } from './magazine/MagazineNav';
import ArticleHero from './magazine/ArticleHero';
import ArticleMetaBar from './magazine/ArticleMetaBar';
import TableOfContents from './magazine/TableOfContents';
import FaqAccordion from './magazine/FaqAccordion';
import ArticleGallery from './magazine/ArticleGallery';
import BusinessMatchGrid from './magazine/BusinessMatchGrid';
import { MagazineArticleGrid } from './magazine/MagazineArticleCard';
import { rubriqueLabel } from './rubriques';
import { DISCOVER_COPY, articlePath, discoverPath, initialDiscoverLanguage, normalizeLanguage, rememberDiscoverLanguage } from './i18n';
import DiscoverGameRecommendation from './magazine/DiscoverGameRecommendation';
import { AdSlot } from '../../../shared/components/ads/AdSlot';
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer';
import { parseMarkdownBlocks } from '../../markdown/MarkdownParser';
import { ThemeResolver } from '../../markdown/ThemeResolver';

const DIFFICULTY_LABELS = {
  ar: { facile: 'سهل', moyen: 'متوسط', difficile: 'صعب' },
  fr: { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' },
  en: { facile: 'Easy', moyen: 'Medium', difficile: 'Difficult' },
};

function Spinner() {
  return <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <span className="mk-spin" style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#FF8A00', borderRadius: '50%', display: 'inline-block' }} />
  </div>;
}

// "Ajouter tous les ingrédients au panier" — le panier iFilino est scopé à un
// seul commerce à la fois (voir CartContext.addManyItems, même contrainte
// que ProductCard) : un bouton par commerce d'origine plutôt qu'un bouton
// unique qui écraserait silencieusement les groupes précédents.
function AddIngredientsByShop({ products, onAdded }) {
  const { addManyItems } = useCart();
  const [added, setAdded] = useState({});
  const restoProducts = (products || []).filter(p => p.module === 'resto' && p.availability !== 'out_of_stock');
  if (!restoProducts.length) return null;

  const byShop = restoProducts.reduce((acc, p) => {
    (acc[p.business.slug] ??= { name: p.business.name, items: [] }).items.push(p);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0' }}>
      {Object.entries(byShop).map(([slug, group]) => (
        <button key={slug} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            addManyItems(slug, group.name, group.items.map(p => ({ id: p.id, libelle: p.name, unit_price: p.price, image_url: p.images?.[0] || null })));
            setAdded(prev => ({ ...prev, [slug]: true }));
            onAdded?.(`${group.items.length} ingrédients ajoutés au panier chez ${group.name}`);
          }}>
          {added[slug] ? '✓ Ajouté' : `Ajouter les ${group.items.length} ingrédients chez ${group.name}`}
        </button>
      ))}
    </div>
  );
}


function PromotionsBlock({ promotions, language = 'fr' }) {
  if (!promotions?.length) return null;
  return (
    <section className="ifm-conversion-block">
      <div>
        <p className="ifm-kicker">{DISCOVER_COPY[normalizeLanguage(language)].currentPromotions}</p>
        <h2>{DISCOVER_COPY[normalizeLanguage(language)].promoCodes}</h2>
      </div>
      <div className="ifm-promo-grid">
        {promotions.map(p => (
          <a key={p.code} className="ifm-promo-card" href={`/${p.business.url_prefix}/${p.business.slug}`}>
            <strong>{p.code}</strong>
            <span>{p.type === 'percent' ? `${p.value}%` : `${p.value} MAD`} {normalizeLanguage(language) === 'ar' ? 'لدى' : normalizeLanguage(language) === 'en' ? 'at' : 'chez'} {p.business.name}</span>
            {p.valid_until && <small>{DISCOVER_COPY[normalizeLanguage(language)].validUntil} {new Date(p.valid_until).toLocaleDateString(DISCOVER_COPY[normalizeLanguage(language)].locale)}</small>}
          </a>
        ))}
      </div>
    </section>
  );
}

function SourcesBlock({ sources, title = 'Sources' }) {
  if (!sources?.length) return null;
  return (
    <section className="ifm-sources">
      <h2>{title}</h2>
      <ul>
        {sources.map((source, index) => (
          <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>
        ))}
      </ul>
    </section>
  );
}

function MarketplaceCta({ cta, language = 'fr' }) {
  if (!cta?.href) return null;
  return (
    <section className="ifm-final-cta">
      <div>
        <p className="ifm-kicker">iFilino Marketplace</p>
        <h2>{DISCOVER_COPY[normalizeLanguage(language)].inspirationToOrder}</h2>
        <p>{DISCOVER_COPY[normalizeLanguage(language)].marketplacePitch}</p>
      </div>
      <a className="btn btn-primary" href={cta.href}>{cta.label || DISCOVER_COPY[normalizeLanguage(language)].discoverMarketplace}</a>
    </section>
  );
}

export default function ArticlePage() {
  const { slug, lang: routeLang } = useParams();
  const language = normalizeLanguage(routeLang || initialDiscoverLanguage());
  const copy = DISCOVER_COPY[language];
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sidebar, setSidebar] = useState({ popular: [], recent: [], tags: [], rubriques: [], promotions: [] });
  const [toast, setToast] = useState('');

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetch(API(`/discover/articles/${slug}?lang=${language}`))
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => setArticle(d.article))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    window.scrollTo({ top: 0 });
  }, [slug, language]);

  useEffect(() => {
    Promise.all([
      fetch(API(`/discover/popular?limit=5&lang=${language}`)).then(r => r.json()).catch(() => ({ articles: [] })),
      fetch(API(`/discover/recent?limit=5&lang=${language}`)).then(r => r.json()).catch(() => ({ articles: [] })),
      fetch(API(`/discover/tags/popular?limit=15&lang=${language}`)).then(r => r.json()).catch(() => ({ tags: [] })),
      fetch(API(`/discover/rubriques?lang=${language}`)).then(r => r.json()).catch(() => ({ rubriques: [] })),
      fetch(API('/discover/promotions?limit=5')).then(r => r.json()).catch(() => ({ promotions: [] })),
    ]).then(([popular, recent, tags, rubriques, promotions]) => {
      setSidebar({ popular: popular.articles || [], recent: recent.articles || [], tags: tags.tags || [], rubriques: rubriques.rubriques || [], promotions: promotions.promotions || [] });
    });
  }, [language]);

  async function handleNewsletterSubmit(e) {
    e.preventDefault();
    const email = e.target.elements.email.value;
    try {
      await fetch(API('/discover/newsletter/subscribe'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      setToast(copy.newsletterOk);
      e.target.reset();
    } catch { setToast(copy.newsletterError); }
  }

  function handleCopyLink(url) {
    navigator.clipboard?.writeText(url).then(() => setToast(copy.copyOk)).catch(() => {});
  }

  if (loading) return <Spinner />;
  if (notFound || !article) return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{copy.notFound}</div>
    </div>
  );

  const meta = article.recipe_meta;
  const rubriqueCounts = Object.fromEntries(sidebar.rubriques.map(r => [r.key, r.count]));
  const firstBusiness = article.related_businesses?.[0];
  const cta = article.cta || (firstBusiness ? { href: `/${firstBusiness.url_prefix}/${firstBusiness.slug}`, label: copy.viewShop } : { href: '/marketplace', label: copy.discoverMarketplace });
  const effectiveLanguage = normalizeLanguage(article.language || language);
  const url = `${window.location.origin}${articlePath(article, effectiveLanguage)}`;
  const missingLabel = article.missing_language ? (language === 'en' ? copy.unavailableEnglish : language === 'fr' ? copy.onlyArabic : copy.unavailableFr) : '';
  rememberDiscoverLanguage(effectiveLanguage);
  document.documentElement.lang = effectiveLanguage;
  document.documentElement.dir = DISCOVER_COPY[effectiveLanguage].dir;

  return (
    <div className="mk-wrap mk-light" lang={effectiveLanguage} dir={DISCOVER_COPY[effectiveLanguage].dir} style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      <MagazineNavbar activeRubrique={article.rubrique || ''} language={effectiveLanguage} languageUrls={article.language_urls} />
      <div className="ifm-layout">
        <MagazineSidebar
          activeRubrique={article.rubrique}
          rubriqueCounts={rubriqueCounts}
          popular={sidebar.popular}
          recent={sidebar.recent}
          tags={sidebar.tags}
          promotions={sidebar.promotions}
          language={effectiveLanguage}
          onDownloadClick={() => setToast(DISCOVER_COPY[effectiveLanguage].comingSoon)}
          onNewsletterSubmit={handleNewsletterSubmit}
        />
        <main className="ifm-main">
          <MagazineHeader placeholder={DISCOVER_COPY[effectiveLanguage].search} ctaLabel={DISCOVER_COPY[effectiveLanguage].order} />
          {missingLabel && <div className="alert alert-info" style={{ marginBottom: 16 }}>{missingLabel}</div>}
          <ArticleMetaBar article={article} rubriqueLabel={rubriqueLabel(article.rubrique, effectiveLanguage)} url={url} onCopyLink={() => handleCopyLink(url)} language={effectiveLanguage} />
          <ArticleHero article={article} ctaHref={cta.href} ctaLabel={cta.label} />
          <TableOfContents toc={article.toc} />

          {meta && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '16px 0', fontSize: 13 }}>
              {meta.duration_minutes && <span className="mk-pill active">⏱ {meta.duration_minutes} min</span>}
              {meta.difficulty && <span className="mk-pill active">{DIFFICULTY_LABELS[effectiveLanguage]?.[meta.difficulty] || meta.difficulty}</span>}
            </div>
          )}

          {meta?.ingredients?.length > 0 && (
            <section style={{ margin: '24px 0' }}>
              <h2 style={{ fontSize: 18 }}>{DISCOVER_COPY[effectiveLanguage].ingredients}</h2>
              <ul>{meta.ingredients.map((ing, i) => <li key={i}>{ing.quantity ? `${ing.quantity} ` : ''}{ing.name}</li>)}</ul>
              <AddIngredientsByShop products={article.related_products} onAdded={setToast} />
            </section>
          )}

          <MarkdownRenderer blocks={parseMarkdownBlocks(article.blocks)} theme={ThemeResolver.resolve('discover')} />

          <div style={{ margin: '20px 0' }}>
            <AdSlot placement="article_inline" platform="discover" language={effectiveLanguage} />
          </div>

          {meta?.steps?.length > 0 && (
            <section style={{ margin: '24px 0' }}>
              <h2 style={{ fontSize: 18 }}>{DISCOVER_COPY[effectiveLanguage].steps}</h2>
              <ol>{meta.steps.map((step, i) => <li key={i} style={{ marginBottom: 8 }}>{step}</li>)}</ol>
            </section>
          )}

          <ArticleGallery illustrations={article.image_assets?.illustrations} bodyHtml={article.body_html} />

          <FaqAccordion faq={article.faq} language={effectiveLanguage} />

          {article.related_products?.length > 0 && (
            <section style={{ marginTop: 32 }}>
              <h2 style={{ fontSize: 18 }}>{DISCOVER_COPY[effectiveLanguage].recommendedProducts}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 14 }}>
                {article.related_products.map(p => <ProductCard key={`${p.module}-${p.id}`} product={p} />)}
              </div>
            </section>
          )}

          <BusinessMatchGrid businesses={article.related_businesses} title={DISCOVER_COPY[effectiveLanguage].recommendedBusinesses} />

          <PromotionsBlock promotions={article.promotions} language={effectiveLanguage} />
          <DiscoverGameRecommendation article={article} language={effectiveLanguage} />
          <MarketplaceCta cta={cta} language={effectiveLanguage} />
          <SourcesBlock sources={article.sources} title={DISCOVER_COPY[effectiveLanguage].sources} />

          {article.related_articles?.length > 0 && (
            <section style={{ marginTop: 40 }}>
              <h2 style={{ fontSize: 18 }}>{DISCOVER_COPY[effectiveLanguage].readAlso}</h2>
              <MagazineArticleGrid articles={article.related_articles} language={effectiveLanguage} />
            </section>
          )}
        </main>
      </div>
      <MagazineFooter language={effectiveLanguage} />
      <Toast msg={toast} onClose={() => setToast('')} />
    </div>
  );
}
