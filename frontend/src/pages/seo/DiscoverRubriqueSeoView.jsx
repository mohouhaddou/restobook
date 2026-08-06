import React from 'react';
import Breadcrumbs from './components/Breadcrumbs';
import MagazineSidebar from '../discover/magazine/MagazineSidebar';
import MagazineHeader from '../discover/magazine/MagazineHeader';
import { MagazineFooter, MagazineNavbar } from '../discover/magazine/MagazineNav';
import { MagazineArticleGrid } from '../discover/magazine/MagazineArticleCard';
import { DISCOVER_COPY, discoverPath, normalizeLanguage } from '../discover/i18n';

// Remplace DiscoverCategorySeoView.jsx — taxonomie `rubrique` (voir
// discover/rubriques.js) au lieu de `category`, layout magazine complet.
export default function DiscoverRubriqueSeoView({ rubrique, articles, page, pages, popular, tags, rubriques, language = 'ar' }) {
  const lang = normalizeLanguage(language);
  const copy = DISCOVER_COPY[lang];
  const rubriqueCounts = Object.fromEntries((rubriques || []).map(r => [r.key, r.count]));
  return (
    <div className="mk-wrap mk-light" lang={lang} dir={copy.dir} style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      <MagazineNavbar activeRubrique={rubrique.key || ''} language={lang} />
      <div className="ifm-layout">
        <MagazineSidebar activeRubrique={rubrique.key} rubriqueCounts={rubriqueCounts} popular={popular} tags={tags} language={lang} />
        <main className="ifm-main">
          <MagazineHeader placeholder={copy.search} ctaLabel={copy.order} />
          <Breadcrumbs items={[{ name: copy.home, path: '/' }, { name: 'Discover', path: discoverPath(lang) }, { name: rubrique.label }]} />
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>{rubrique.label}</h1>
          <MagazineArticleGrid articles={articles} language={lang} />
          {pages > 1 && (
            <nav style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 28 }} aria-label="Pagination">
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <a key={p} className={`mk-pill${p === page ? ' active' : ''}`} href={p === 1 ? discoverPath(lang, rubrique.key) : `${discoverPath(lang, rubrique.key)}?page=${p}`}>{p}</a>
              ))}
            </nav>
          )}
        </main>
      </div>
      <MagazineFooter language={lang} />
    </div>
  );
}
