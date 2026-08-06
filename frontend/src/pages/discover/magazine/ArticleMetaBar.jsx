import React from 'react';
import Breadcrumbs from '../../seo/components/Breadcrumbs';
import ShareButtons from './ShareButtons';
import { DISCOVER_COPY, discoverPath, normalizeLanguage } from '../i18n';

function formatDate(iso, language = 'fr') {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(DISCOVER_COPY[normalizeLanguage(language)]?.locale || 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return ''; }
}

// Fil d'ariane + date + temps de lecture + auteur + partage — regroupés en
// une barre pour éviter de dupliquer cette logique entre SSR et CSR (voir
// plan Discover Magazine §4).
export default function ArticleMetaBar({ article, rubriqueLabel, url, onCopyLink, language = 'ar' }) {
  const lang = normalizeLanguage(language);
  const copy = DISCOVER_COPY[lang];
  return (
    <>
      <Breadcrumbs items={[
        { name: copy.home, path: '/' },
        { name: 'Discover', path: discoverPath(lang) },
        { name: rubriqueLabel, path: discoverPath(lang, article.rubrique) },
        { name: article.title },
      ]} />
      <div className="ifm-article-meta-bar">
        <span>📅 {formatDate(article.published_at, lang)}</span>
        <span>👤 {copy.team}</span>
        <span>🕒 {article.reading_time_minutes} {copy.readingTime}</span>
        <span className="mk-pill active" style={{ fontSize: 11 }}>{rubriqueLabel}</span>
        <ShareButtons url={url} title={article.title} article={article} onCopyLink={onCopyLink} />
      </div>
    </>
  );
}
