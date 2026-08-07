import React from 'react';
import { ASSET } from '../../../../api';
import { rubriqueLabel } from '../rubriques';
import { articlePath, normalizeLanguage } from '../i18n';

export function MagazineArticleCard({ article, language = 'ar' }) {
  const lang = normalizeLanguage(article.language || language);
  const cardImage = article.image_assets?.thumbnail?.url || article.cover_image_url;
  return (
    <a href={articlePath(article, lang)} className="mk-card mk-fade-up" style={{ display: 'block', overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}>
      {cardImage && <img src={ASSET(cardImage)} alt={article.title} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover' }} />}
      <div style={{ padding: 14 }}>
        <span className="mk-pill active" style={{ fontSize: 11 }}>{rubriqueLabel(article.rubrique, lang)}</span>
        <h3 style={{ margin: '8px 0 4px', fontSize: 15, fontWeight: 700 }}>{article.title}</h3>
        {article.excerpt && <p style={{ margin: 0, fontSize: 13, color: 'var(--mk-muted)' }}>{article.excerpt}</p>}
        {article.city && <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--mk-muted)' }}>📍 {article.city.name}</p>}
      </div>
    </a>
  );
}

export function MagazineArticleGrid({ articles, language = 'ar' }) {
  if (!articles?.length) return null;
  return <div className="ifm-article-grid">{articles.map(a => <MagazineArticleCard key={a.slug} article={a} language={language} />)}</div>;
}
