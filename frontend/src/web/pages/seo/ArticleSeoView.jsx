import React from 'react';
import MagazineSidebar from '../discover/magazine/MagazineSidebar';
import MagazineHeader from '../discover/magazine/MagazineHeader';
import { MagazineFooter, MagazineNavbar } from '../discover/magazine/MagazineNav';
import ArticleHero from '../discover/magazine/ArticleHero';
import ArticleMetaBar from '../discover/magazine/ArticleMetaBar';
import TableOfContents from '../discover/magazine/TableOfContents';
import FaqAccordion from '../discover/magazine/FaqAccordion';
import ArticleGallery from '../discover/magazine/ArticleGallery';
import BusinessMatchGrid from '../discover/magazine/BusinessMatchGrid';
import { MagazineArticleGrid } from '../discover/magazine/MagazineArticleCard';
import { articlePath, normalizeLanguage, DISCOVER_COPY } from '../discover/i18n';

const URL_PREFIX_BY_MODULE = { resto: 'restaurants', hanout: 'epiceries', pharmacie: 'pharmacies' };
const DIFFICULTY_LABELS = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' };

function ProductChip({ p }) {
  const bizPrefix = URL_PREFIX_BY_MODULE[p.module] || 'restaurants';
  return (
    <a href={`/produits/${p.slug}`} className="mk-card" style={{ display: 'block', padding: 12, textDecoration: 'none', color: 'inherit' }}>
      {p.images?.[0] && <img src={p.images[0]} alt={p.name} width={160} height={110} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8, marginBottom: 6 }} />}
      <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
      {p.price != null && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mk-orange, #FF8A00)' }}>{Number(p.price).toFixed(2)} MAD</div>}
      <div style={{ fontSize: 11, color: 'var(--mk-muted, #64748B)' }}>Chez {p.business?.name} · <span style={{ textDecoration: 'underline' }}>voir le commerce</span></div>
    </a>
  );
}

export default function ArticleSeoView({ article: a, rubriqueLabel, popular, tags, rubriques }) {
  const lang = normalizeLanguage(a.language || 'ar');
  const copy = DISCOVER_COPY[lang];
  const meta = a.recipe_meta;
  const rubriqueCounts = Object.fromEntries((rubriques || []).map(r => [r.key, r.count]));
  const firstBusiness = a.related_businesses?.[0];
  const ctaHref = firstBusiness ? `/${firstBusiness.url_prefix}/${firstBusiness.slug}` : '/marketplace';
  const url = `https://ifilino.com${articlePath(a, lang)}`;

  return (
    <div className="mk-wrap mk-light" lang={lang} dir={copy.dir} style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      <MagazineNavbar activeRubrique={a.rubrique || ''} language={lang} languageUrls={a.language_urls} />
      <div className="ifm-layout">
        <MagazineSidebar activeRubrique={a.rubrique} rubriqueCounts={rubriqueCounts} popular={popular} tags={tags} language={lang} />
        <main className="ifm-main">
          <MagazineHeader placeholder={copy.search} ctaLabel={copy.order} />
          <ArticleMetaBar article={a} rubriqueLabel={rubriqueLabel} url={url} language={lang} />
          <ArticleHero article={a} ctaHref={ctaHref} />
          <TableOfContents toc={a.toc} />

          {meta && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '16px 0', fontSize: 13 }}>
              {meta.duration_minutes && <span className="mk-pill active">⏱ {meta.duration_minutes} min</span>}
              {meta.difficulty && <span className="mk-pill active">{DIFFICULTY_LABELS[meta.difficulty] || meta.difficulty}</span>}
            </div>
          )}

          {meta?.ingredients?.length > 0 && (
            <section style={{ margin: '24px 0' }}>
              <h2 style={{ fontSize: 18 }}>{copy.ingredients}</h2>
              <ul>
                {meta.ingredients.map((ing, i) => (
                  <li key={i}>{ing.quantity ? `${ing.quantity} ` : ''}{ing.name}</li>
                ))}
              </ul>
            </section>
          )}

          {/* eslint-disable-next-line react/no-danger -- Markdown déjà rendu et échappé côté backend (marked), auteurs = staff de confiance, voir plan Discover décision 2 */}
          <div className="ifm-body" dangerouslySetInnerHTML={{ __html: a.body_html }} />

          {meta?.steps?.length > 0 && (
            <section style={{ margin: '24px 0' }}>
              <h2 style={{ fontSize: 18 }}>{copy.steps}</h2>
              <ol>
                {meta.steps.map((step, i) => <li key={i} style={{ marginBottom: 8 }}>{step}</li>)}
              </ol>
            </section>
          )}

          <ArticleGallery illustrations={a.image_assets?.illustrations} bodyHtml={a.body_html} />

          <FaqAccordion faq={a.faq} language={lang} />

          {a.related_products?.length > 0 && (
            <section style={{ marginTop: 32 }}>
              <h2 style={{ fontSize: 18 }}>{copy.recommendedProducts}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 12 }}>
                {a.related_products.map(p => <ProductChip key={`${p.module}-${p.id}`} p={p} />)}
              </div>
            </section>
          )}

          <BusinessMatchGrid businesses={a.related_businesses} title={copy.recommendedBusinesses} />

          {a.related_articles?.length > 0 && (
            <section style={{ marginTop: 40 }}>
              <h2 style={{ fontSize: 18 }}>{copy.readAlso}</h2>
              <MagazineArticleGrid articles={a.related_articles} language={lang} />
            </section>
          )}
        </main>
      </div>
      <MagazineFooter language={lang} />
    </div>
  );
}
