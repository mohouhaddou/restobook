import React, { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { API } from '../../../api';
import { useI18n } from '../../../i18n/config';
import CategoryCard from '../../modules/gaminghub/components/CategoryCard';
import '../../modules/gaminghub/gaminghub.css';

export default function CategoriesListPage() {
  const { t, language } = useI18n();
  const [state, setState] = useState({ loading: true, categories: [], counts: {} });

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));
    Promise.all([
      fetch(API(`/gaminghub/categories?lang=${language}`)).then(r => r.json()).catch(() => ({ categories: [] })),
      fetch(API('/gaminghub/games?limit=100')).then(r => r.json()).catch(() => ({ games: [] })),
    ]).then(([catRes, gamesRes]) => {
      if (cancelled) return;
      const counts = {};
      for (const g of gamesRes.games || []) {
        if (g.category?.slug) counts[g.category.slug] = (counts[g.category.slug] || 0) + 1;
      }
      setState({ loading: false, categories: catRes.categories || [], counts });
    }).catch(() => { if (!cancelled) setState({ loading: false, categories: [], counts: {} }); });
    return () => { cancelled = true; };
  }, [language]);

  return (
    <div className="play-page">
      <main className="play-container">
        <div className="gh-page-header">
          <h1><Layers size={26} />{t('gaminghub.listing.categoriesTitle')}</h1>
          <p>{t('gaminghub.listing.categoriesSubtitle')}</p>
        </div>

        {state.loading && <div className="play-skeleton-grid">{Array.from({ length: 8 }, (_, i) => <span key={i} />)}</div>}

        {!state.loading && !state.categories.length && (
          <div className="gh-empty-state"><Layers size={40} /><strong>{t('gaminghub.listing.empty')}</strong></div>
        )}

        {!state.loading && state.categories.length > 0 && (
          <div className="gh-category-grid">
            {state.categories.map(c => <CategoryCard key={c.slug} category={c} count={state.counts[c.slug]} />)}
          </div>
        )}
      </main>
    </div>
  );
}
