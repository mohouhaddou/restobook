import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Gamepad2, Newspaper, Search } from 'lucide-react';
import { API } from '../../api';
import { useI18n } from '../../i18n/config';
import GamingCard from '../../modules/gaminghub/components/GamingCard';
import ArticleCard from '../../modules/gaminghub/components/ArticleCard';
import '../../modules/gaminghub/gaminghub.css';

// Aucun paramètre de recherche côté API (voir plan §Sourcing) — filtrage
// 100% client sur les listes déjà publiques (nom/titre/tags), avec debounce.
// Catalogue actuel modeste : pas de souci de performance ; si le catalogue
// grossit nettement, ce sera le signal pour ajouter un vrai paramètre `q`
// côté backend (hors scope de cette refonte frontend-only).
export default function GamingSearchPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState({ loading: true, games: [], articles: [] });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(API('/gaminghub/games?limit=50')).then(r => r.json()).catch(() => ({ games: [] })),
      fetch(API('/gaminghub/articles?limit=50')).then(r => r.json()).catch(() => ({ articles: [] })),
    ]).then(([gamesRes, articlesRes]) => {
      if (!cancelled) setState({ loading: false, games: gamesRes.games || [], articles: articlesRes.articles || [] });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input);
      setSearchParams(input ? { q: input } : {});
    }, 250);
    return () => clearTimeout(timer);
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return { games: [], articles: [] };
    const games = state.games.filter(g => g.name?.toLowerCase().includes(needle) || g.genre?.toLowerCase().includes(needle) || (g.tags || []).some(tag => tag.toLowerCase().includes(needle)));
    const articles = state.articles.filter(a => a.title?.toLowerCase().includes(needle) || (a.tags || []).some(tag => tag.toLowerCase().includes(needle)));
    return { games, articles };
  }, [query, state.games, state.articles]);

  const hasQuery = query.trim().length > 0;
  const hasResults = results.games.length > 0 || results.articles.length > 0;

  return (
    <div className="play-page">
      <main className="play-container">
        <div className="gh-page-header">
          <h1><Search size={26} />{t('gaminghub.search.title')}</h1>
          <p>{t('gaminghub.search.subtitle')}</p>
        </div>

        <label className="gh-search-bar" htmlFor="gh-search-input">
          <Search size={20} />
          <input id="gh-search-input" type="search" value={input} autoFocus autoComplete="off" placeholder={t('gaminghub.search.placeholder')} onChange={e => setInput(e.target.value)} />
        </label>

        {!hasQuery && (
          <div className="gh-empty-state"><Search size={40} /><strong>{t('gaminghub.search.prompt')}</strong></div>
        )}

        {hasQuery && !state.loading && !hasResults && (
          <div className="gh-empty-state"><Search size={40} /><strong>{t('gaminghub.search.empty', { query })}</strong></div>
        )}

        {hasQuery && results.games.length > 0 && (
          <section className="gh-search-section">
            <h2><Gamepad2 size={18} />{t('gaminghub.search.gamesHeading', { count: results.games.length })}</h2>
            <div className="play-game-rail-track grid">
              {results.games.map(g => <GamingCard key={g.slug} game={g} />)}
            </div>
          </section>
        )}

        {hasQuery && results.articles.length > 0 && (
          <section className="gh-search-section">
            <h2><Newspaper size={18} />{t('gaminghub.search.articlesHeading', { count: results.articles.length })}</h2>
            <div className="play-game-rail-track grid">
              {results.articles.map(a => <ArticleCard key={a.slug} article={a} />)}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
