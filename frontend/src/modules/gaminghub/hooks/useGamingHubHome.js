import { useEffect, useState } from 'react';
import { API } from '../../../api';

// Sourcing des 9 sections de la Home Gaming Hub à partir des seuls endpoints
// publics existants (aucune nouvelle route) : 2 fetch de base (games,
// articles) + un fetch "similar" ancré sur le jeu le plus populaire + jusqu'à
// 4 fetch de détail (parallèles) pour agréger les dernières mises à jour.
// Chaque section se masque si aucune donnée réelle ne qualifie — jamais de
// contenu fabriqué (ex. "jeux les plus attendus" reste vide tant qu'aucun
// jeu n'a de release_date future renseignée).
export function useGamingHubHome() {
  const [state, setState] = useState({
    loading: true,
    heroGames: [],
    gameCount: 0,
    popular: [],
    upcoming: [],
    news: [],
    guides: [],
    collections: [],
    trending: [],
    updates: [],
    similar: { anchorGame: null, games: [] },
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [gamesRes, articlesRes] = await Promise.all([
        fetch(API('/gaminghub/games?limit=20')).then(r => r.json()).catch(() => ({ games: [], count: 0 })),
        fetch(API('/gaminghub/articles?limit=40')).then(r => r.json()).catch(() => ({ articles: [] })),
      ]);
      if (cancelled) return;

      const games = gamesRes.games || [];
      const articles = articlesRes.articles || [];

      const popular = [...games].sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
      const now = Date.now();
      const upcoming = games
        .filter(g => g.release_date && new Date(g.release_date).getTime() > now)
        .sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
      const heroGames = games.slice(0, 5);

      const byType = type => articles.filter(a => a.article_type === type);
      const trending = [...articles].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 6);

      let similar = { anchorGame: null, games: [] };
      let updates = [];
      const anchor = popular[0];
      if (anchor) {
        const [similarRes, ...detailResults] = await Promise.all([
          fetch(API(`/gaminghub/games/${anchor.slug}/similar?limit=8`)).then(r => r.json()).catch(() => ({ games: [] })),
          ...popular.slice(0, 4).map(g => fetch(API(`/gaminghub/games/${g.slug}`)).then(r => r.json()).catch(() => null)),
        ]);
        if (cancelled) return;
        similar = { anchorGame: anchor, games: similarRes.games || [] };
        updates = detailResults
          .filter(Boolean)
          .flatMap(res => (res.game?.updates || []).map(u => ({ ...u, gameName: res.game.name, gameSlug: res.game.slug })))
          .filter(u => u.released_at)
          .sort((a, b) => new Date(b.released_at) - new Date(a.released_at))
          .slice(0, 6);
      }

      if (cancelled) return;
      setState({
        loading: false,
        heroGames,
        gameCount: gamesRes.count || games.length,
        popular: popular.slice(0, 8),
        upcoming: upcoming.slice(0, 6),
        news: byType('actualite').slice(0, 6),
        guides: byType('guide').slice(0, 6),
        collections: byType('collection').slice(0, 6),
        trending,
        updates,
        similar,
      });
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return state;
}
