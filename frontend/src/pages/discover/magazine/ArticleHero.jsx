import React from 'react';
import { ASSET } from '../../../api';

// Hero premium — image de couverture réelle (jamais générée, voir plan
// Discover Magazine §Décision images) + overlay titre/résumé + CTA
// marketplace vers le premier commerce concerné le cas échéant.
export default function ArticleHero({ article, ctaHref, ctaLabel = 'Commander maintenant sur iFilino' }) {
  return (
    <div className="ifm-hero">
      {article.cover_image_url && (
        <img src={ASSET(article.cover_image_url)} alt={article.title} />
      )}
      <div className="ifm-hero-overlay">
        <h1 className="ifm-hero-title">{article.title}</h1>
        {article.excerpt && <p className="ifm-hero-excerpt">{article.excerpt}</p>}
        {ctaHref && <a className="ifm-hero-cta" href={ctaHref}>{ctaLabel} →</a>}
      </div>
    </div>
  );
}
