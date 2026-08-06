import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { API } from '../../api';
import { useI18n } from '../../i18n/config';
import ArticleCard from '../../modules/gaminghub/components/ArticleCard';
import '../../modules/gaminghub/gaminghub.css';

const ARTICLE_TYPES = ['actualite', 'guide', 'astuce', 'test', 'classement', 'comparatif', 'top', 'collection'];
const PAGE_LIMIT = 12;

// Index éditorial Gaming Hub — un seul composant réutilisé pour /gaming/articles
// (tous types, sélecteur visible), /gaming/actualites, /gaming/guides,
// /gaming/tests (type verrouillé via `forcedType`, titre dédié) — évite de
// dupliquer 4 pages quasi identiques.
export default function ArticlesListPage({ forcedType = null, titleKey = 'gaminghub.listing.articlesTitle' }) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const type = forcedType || searchParams.get('type') || '';
  const [state, setState] = useState({ loading: true, articles: [], page: 1, pages: 1 });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, articles: [], page: 1, pages: 1 });
    const qs = new URLSearchParams({ limit: String(PAGE_LIMIT), page: '1' });
    if (type) qs.set('type', type);
    fetch(API(`/gaminghub/articles?${qs.toString()}`))
      .then(r => r.json())
      .then(data => { if (!cancelled) setState({ loading: false, articles: data.articles || [], page: data.page || 1, pages: data.pages || 1 }); })
      .catch(() => { if (!cancelled) setState({ loading: false, articles: [], page: 1, pages: 1 }); });
    return () => { cancelled = true; };
  }, [type]);

  async function loadMore() {
    const nextPage = state.page + 1;
    const qs = new URLSearchParams({ limit: String(PAGE_LIMIT), page: String(nextPage) });
    if (type) qs.set('type', type);
    const data = await fetch(API(`/gaminghub/articles?${qs.toString()}`)).then(r => r.json()).catch(() => null);
    if (!data) return;
    setState(s => ({ ...s, articles: [...s.articles, ...(data.articles || [])], page: data.page }));
  }

  return (
    <div className="play-page">
      <main className="play-container">
        <div className="gh-page-header">
          <h1><Newspaper size={26} />{t(titleKey)}</h1>
          <p>{t('gaminghub.listing.articlesSubtitle')}</p>
        </div>

        {!forcedType && (
          <div className="gh-filter-row" role="tablist" aria-label={t('gaminghub.listing.filterByType')}>
            <button type="button" className={`gh-filter-pill${!type ? ' active' : ''}`} onClick={() => setSearchParams({})}>{t('gaminghub.listing.allTypes')}</button>
            {ARTICLE_TYPES.map(tp => (
              <button key={tp} type="button" className={`gh-filter-pill${type === tp ? ' active' : ''}`} onClick={() => setSearchParams({ type: tp })}>{t(`gaminghub.type.${tp}`)}</button>
            ))}
          </div>
        )}

        {state.loading && (
          <div className="play-skeleton-grid">{Array.from({ length: 6 }, (_, i) => <span key={i} />)}</div>
        )}

        {!state.loading && !state.articles.length && (
          <div className="gh-empty-state"><Newspaper size={40} /><strong>{t('gaminghub.listing.empty')}</strong></div>
        )}

        {!state.loading && state.articles.length > 0 && (
          <>
            <div className="play-game-rail-track grid">
              {state.articles.map(a => <ArticleCard key={a.slug} article={a} />)}
            </div>
            {state.page < state.pages && (
              <button type="button" className="play-show-more" onClick={loadMore}>{t('gaminghub.listing.loadMore')}</button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
