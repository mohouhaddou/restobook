import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';
import { API } from '../../../api';
import { useI18n } from '../../../i18n/config';
import GamingCard from '../../modules/gaminghub/components/GamingCard';
import '../../modules/gaminghub/gaminghub.css';

const PAGE_LIMIT = 12;

export default function GamesListPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || '';
  const [state, setState] = useState({ loading: true, games: [], page: 1, pages: 1 });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, games: [], page: 1, pages: 1 });
    const qs = new URLSearchParams({ limit: String(PAGE_LIMIT), page: '1' });
    if (category) qs.set('category', category);
    fetch(API(`/gaminghub/games?${qs.toString()}`))
      .then(r => r.json())
      .then(data => { if (!cancelled) setState({ loading: false, games: data.games || [], page: data.page || 1, pages: data.pages || 1 }); })
      .catch(() => { if (!cancelled) setState({ loading: false, games: [], page: 1, pages: 1 }); });
    return () => { cancelled = true; };
  }, [category]);

  async function loadMore() {
    const nextPage = state.page + 1;
    const qs = new URLSearchParams({ limit: String(PAGE_LIMIT), page: String(nextPage) });
    if (category) qs.set('category', category);
    const data = await fetch(API(`/gaminghub/games?${qs.toString()}`)).then(r => r.json()).catch(() => null);
    if (!data) return;
    setState(s => ({ ...s, games: [...s.games, ...(data.games || [])], page: data.page }));
  }

  return (
    <div className="play-page">
      <main className="play-container">
        <div className="gh-page-header">
          <h1><Gamepad2 size={26} />{t('gaminghub.listing.gamesTitle')}</h1>
          <p>{t('gaminghub.listing.gamesSubtitle')}</p>
        </div>

        {state.loading && <div className="play-skeleton-grid">{Array.from({ length: 6 }, (_, i) => <span key={i} />)}</div>}

        {!state.loading && !state.games.length && (
          <div className="gh-empty-state"><Gamepad2 size={40} /><strong>{t('gaminghub.listing.empty')}</strong></div>
        )}

        {!state.loading && state.games.length > 0 && (
          <>
            <div className="play-game-rail-track grid">
              {state.games.map(g => <GamingCard key={g.slug} game={g} />)}
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
