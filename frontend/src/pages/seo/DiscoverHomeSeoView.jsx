import React from 'react';
import MagazineSidebar from '../discover/magazine/MagazineSidebar';
import MagazineHeader from '../discover/magazine/MagazineHeader';
import { MagazineFooter, MagazineNavbar } from '../discover/magazine/MagazineNav';
import { MagazineArticleGrid } from '../discover/magazine/MagazineArticleCard';
import { DISCOVER_COPY, discoverPath, normalizeLanguage } from '../discover/i18n';

export default function DiscoverHomeSeoView({ articles, page, pages, popular, tags, rubriques, language = 'ar' }) {
  const lang = normalizeLanguage(language);
  const copy = DISCOVER_COPY[lang];
  const rubriqueCounts = Object.fromEntries((rubriques || []).map(r => [r.key, r.count]));
  return (
    <div className="mk-wrap mk-light" lang={lang} dir={copy.dir} style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      <MagazineNavbar activeRubrique="" language={lang} />
      <div className="ifm-layout">
        <MagazineSidebar rubriqueCounts={rubriqueCounts} popular={popular} tags={tags} language={lang} />
        <main className="ifm-main">
          <MagazineHeader placeholder={copy.search} ctaLabel={copy.order} />
          <h1 style={{ fontSize: 30, fontWeight: 800 }}>iFilino Discover</h1>
          <p style={{ color: 'var(--mk-muted, #64748B)', marginBottom: 24 }}>
            {copy.tagline}
          </p>
          <MagazineArticleGrid articles={articles} language={lang} />
          {pages > 1 && (
            <nav style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 28 }} aria-label="Pagination">
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <a key={p} className={`mk-pill${p === page ? ' active' : ''}`} href={p === 1 ? discoverPath(lang) : `${discoverPath(lang)}?page=${p}`}>{p}</a>
              ))}
            </nav>
          )}
        </main>
      </div>
      <MagazineFooter language={lang} />
    </div>
  );
}
