import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import '../../modules/play/play.css';
import { usePlayApi } from '../../modules/play/hooks/usePlayApi';
import { usePlayContext } from '../../modules/play/PlayContext';
import { getGameSection, humanizeCategory } from '../../modules/play/config/gameCatalogMeta';
import { getRankForLevel } from '../../modules/play/config/playRanks';
import { rankGameRecommendations } from '../../modules/play/services/recommendationService';
import XpBar from '../../modules/play/components/XpBar';
import MissionList from '../../modules/play/components/MissionList';
import BadgeGrid from '../../modules/play/components/BadgeGrid';
import Leaderboard from '../../modules/play/components/Leaderboard';
import { useI18n } from '../../i18n/config';
import PlayHero from '../../modules/play/components/PlayHero';
import PlayGameOfDay from '../../modules/play/components/PlayGameOfDay';
import GamingHubPromoCard from '../../modules/gaminghub/components/GamingHubPromoCard';
import useGameCatalog from '../../modules/play/hooks/useGameCatalog';
import GameRail from '../../modules/play/components/GameRail';
import PersonalGameLibrary from '../../modules/play/components/PersonalGameLibrary';
import usePersonalGameLibrary from '../../modules/play/hooks/usePersonalGameLibrary';
import usePlayPwa from '../../modules/play/hooks/usePlayPwa';
import PlayPwaBanner from '../../modules/play/components/PlayPwaBanner';
import PlaySidebar from '../../modules/play/components/PlaySidebar';

const SECTION_LABELS = {
  populaires: { title: 'Jeux populaires' },
  quiz: { title: 'Quiz' },
  puzzle: { title: 'Puzzle' },
  voyage: { title: 'Voyage' },
  culture: { title: 'Culture' },
};
const SECTION_ORDER = ['populaires', 'quiz', 'puzzle', 'voyage', 'culture'];
const NEW_GAMES_WINDOW = 12;

export default function PlayHomePage() {
  const { get, post, isGuest } = usePlayApi();
  const { profile, refreshProfile } = usePlayContext();
  const { t } = useI18n();
  const [apiGames, setApiGames] = useState([]);
  const [missions, setMissions] = useState([]);
  const [badges, setBadges] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [trendingSlugs, setTrendingSlugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("ifilino-play-view") || "grid");
  const { games, allGames, total, query, setQuery, category, setCategory, categories, filters, setFilter, resetFilters, activeFilterCount } = useGameCatalog(apiGames, t);
  const library = usePersonalGameLibrary(allGames);
  const pwa = usePlayPwa();
  const location = useLocation();

  // Catégorie choisie depuis la sidebar — /play?category=arcade présélectionne
  // le filtre. Dépend de location.search (pas juste du montage) : cliquer un
  // lien de la sidebar depuis /play ne remonte pas ce composant, seul
  // l'effet est re-déclenché par le changement de l'URL.
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('category');
    if (requested) setCategory(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Liens d'ancre de la sidebar (#trending, #new) — la navigation React
  // Router ne déclenche pas le scroll natif du navigateur vers l'ancre.
  useEffect(() => {
    if (!location.hash || loading) return;
    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, loading]);

  useEffect(() => {
    Promise.all([
      get('/play/games'),
      get('/play/missions/daily'),
      get('/play/badges'),
      get('/play/leaderboard?scope=world&period=global'),
      get('/play/trending'),
    ]).then(([g, m, b, l, tr]) => {
      setApiGames(g.games || []);
      setMissions(m.missions || []);
      setBadges(b.badges || []);
      setLeaderboard(l);
      setTrendingSlugs(tr.slugs || []);
    }).finally(() => setLoading(false));
  }, [get, t]);

  const newSlugSet = useMemo(() => new Set(
    [...allGames]
      .filter(g => g.addedAt || g.createdAt)
      .sort((a, b) => new Date(b.addedAt || b.createdAt) - new Date(a.addedAt || a.createdAt))
      .slice(0, NEW_GAMES_WINDOW)
      .map(g => g.slug)
  ), [allGames]);
  const trendingSet = useMemo(() => new Set(trendingSlugs), [trendingSlugs]);
  const enrichedGames = useMemo(() => games.map(g => ({ ...g, isNew: newSlugSet.has(g.slug), isTrending: trendingSet.has(g.slug) })), [games, newSlugSet, trendingSet]);
  const trendingGames = useMemo(() => trendingSlugs.map(slug => enrichedGames.find(g => g.slug === slug)).filter(Boolean), [trendingSlugs, enrichedGames]);
  const newGames = useMemo(() => enrichedGames.filter(g => g.isNew).sort((a, b) => new Date(b.addedAt || b.createdAt) - new Date(a.addedAt || a.createdAt)), [enrichedGames]);
  const anchorGame = library.activity?.[0]?.game || null;
  const recommendedGames = useMemo(() => anchorGame ? rankGameRecommendations({ currentGame: anchorGame, games: enrichedGames, history: library.activity, favoriteSlugs: library.favorites.map(g => g.slug), limit: 8 }) : [], [anchorGame, enrichedGames, library.activity, library.favorites]);
  const heroGames = useMemo(() => allGames.filter(g => g.is_hero), [allGames]);
  const gameOfDay = useMemo(() => allGames.find(g => g.is_game_of_day) || null, [allGames]);

  function handleViewModeChange(mode) {
    setViewMode(mode);
    localStorage.setItem("ifilino-play-view", mode);
  }

  async function handleClaimMission(missionId) {
    try {
      await post(`/play/missions/${missionId}/claim`);
      const { missions: m } = await get('/play/missions/daily');
      setMissions(m || []);
      refreshProfile();
    } catch {}
  }

  const dynamicKeys = [...new Set(enrichedGames.map(getGameSection))].filter(key => !SECTION_ORDER.includes(key)).sort();
  const bySection = [...SECTION_ORDER, ...dynamicKeys].map(key => ({
    key,
    title: SECTION_LABELS[key]?.title || humanizeCategory(key),
    games: enrichedGames.filter(g => getGameSection(g) === key),
  })).filter(s => s.games.length);

  const rank = profile ? getRankForLevel(profile.currentLevel) : null;
  const isFiltering = Boolean(query.trim()) || category !== 'all' || activeFilterCount > 0;

  return (
    <div className="play-page">
      <PlayHero gameCount={total} query={query} onQueryChange={setQuery} heroGames={heroGames}/>
      <div className="play-shell">
      <PlaySidebar catalog={{ categories, activeCategory: category, onCategoryChange: setCategory, resultCount: games.length, query, filters, onFilterChange: setFilter, onReset: resetFilters, activeFilterCount, viewMode, onViewModeChange: handleViewModeChange }}/>
      <div className="play-container">
        {loading && <div className="play-home-skeleton" aria-busy="true" aria-label="Chargement des jeux"><span className="play-skeleton-line wide"/><div className="play-skeleton-grid">{Array.from({ length: 6 }, (_, index) => <span key={index}/>)}</div></div>}

        {/* Recherche/filtre actif : les résultats sont la toute première chose
            affichée, avant tout le reste du tableau de bord (jeu du jour,
            bibliothèque perso, missions, widgets…), qui n'a pas sa place ici. */}
        {!loading && isFiltering && (
          games.length === 0
            ? <div className="play-catalog-empty" role="status"><strong>Aucun jeu trouvé</strong><span>Essayez un autre mot-clé ou une autre catégorie.</span><button type="button" onClick={resetFilters}>Réinitialiser la recherche</button></div>
            : <GameRail sectionKey="results" title={query.trim() ? `Résultats pour « ${query.trim()} »` : 'Résultats'} games={enrichedGames} viewMode={viewMode} action={<button type="button" className="play-rail-reset" onClick={resetFilters}><RotateCcw size={14}/> Réinitialiser</button>}/>
        )}

        {!loading && !isFiltering && (
          <>
            <PlayGameOfDay game={gameOfDay}/>
            <GamingHubPromoCard compact />
            <PlayPwaBanner canInstall={pwa.canInstall} online={pwa.online} onInstall={pwa.install} onDismiss={pwa.dismiss}/>

            {isGuest && (
              <div className="play-guest-banner">
                <span>Vous jouez en tant qu'invité — connectez-vous pour sauvegarder votre progression et réclamer des récompenses.</span>
                <Link to="/account" className="play-btn">Se connecter</Link>
              </div>
            )}

            {profile && <div className="play-home-profile-link"><div><span>Votre progression</span><strong>Retrouvez vos statistiques, badges et dernières parties.</strong></div><Link to="/play/profile" className="play-btn secondary">Voir mon profil Play</Link></div>}

            {profile && (
              <div className="play-summary-row">
                <div className="play-stat-tile">
                  <div className="label">iCoins</div>
                  <div className="value">🪙 {profile.icoinsBalance}</div>
                </div>
                <div className="play-stat-tile">
                  <div className="label">Streak</div>
                  <div className="value">🔥 {profile.currentStreakDays}j</div>
                </div>
                <div className="play-stat-tile">
                  <div className="label">Rang</div>
                  <div className="value" style={{ background: rank?.gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                    {rank?.name}
                  </div>
                </div>
                <div className="play-stat-tile" style={{ gridColumn: 'span 2' }}>
                  <XpBar totalXp={profile.totalXp} currentLevel={profile.currentLevel} levelName={profile.levelName} nextLevel={profile.nextLevel} />
                </div>
              </div>
            )}

            <div className="play-home-grid">
              <div className="play-home-main">
                <PersonalGameLibrary {...library}/>

                <div className="play-section">
                  <div className="play-section-title">🎯 Défis quotidiens</div>
                  <div className="play-card">
                    <MissionList missions={missions} onClaim={handleClaimMission} />
                  </div>
                </div>

                {trendingGames.length > 0 && <div id="trending"><GameRail sectionKey="trending" title="Jeux tendance" games={trendingGames} viewMode={viewMode}/></div>}
                {newGames.length > 0 && <div id="new"><GameRail sectionKey="new" title="Nouveautés" games={newGames} viewMode={viewMode}/></div>}
                {recommendedGames.length > 0 && <GameRail sectionKey="recommended" title="Recommandé pour vous" games={recommendedGames} viewMode={viewMode}/>}

                {bySection.map(section => <GameRail key={section.key} sectionKey={section.key} title={section.title} games={section.games} viewMode={viewMode}/>)}
              </div>

              <aside className="play-home-side">
                <div className="play-home-side-inner">
                  <div className="play-widget-card">
                    <header><span>🏅 Badges</span><Link to="/play/badges">Voir tout</Link></header>
                    <BadgeGrid badges={badges.slice(0, 6)} />
                  </div>

                  <div className="play-widget-card">
                    <header><span>🏆 Classement</span><Link to="/play/leaderboard">Voir tout</Link></header>
                    <Leaderboard entries={leaderboard?.entries?.slice(0, 5)} note={leaderboard?.note} />
                  </div>

                  <div className="play-widget-card">
                    <header><span>🎁 Récompenses</span></header>
                    <p className="play-widget-hint">Échangez vos iCoins contre des réductions et cadeaux.</p>
                    <Link to="/play/rewards" className="play-btn">Voir le catalogue</Link>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
