import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Baby, BrainCircuit, Car, Clock3, Compass, Dumbbell, Filter, Flame, Gamepad2, Globe2,
  GraduationCap, Grid2X2, Grid3X3, LayoutGrid, Layers3, List, MapPinned, Medal, Menu,
  PartyPopper, PawPrint, PenTool, Puzzle, RotateCcw, Sparkles, Swords, Target, TreePine,
  Trophy, User, Bot,
} from 'lucide-react';
import { usePlayApi } from '../hooks/usePlayApi';
import usePlaySidebar from '../hooks/usePlaySidebar';
import { getGameSection, humanizeCategory } from '../config/gameCatalogMeta';

const CATEGORY_LABELS = { populaires: 'Populaires', quiz: 'Quiz', puzzle: 'Puzzle', voyage: 'Voyage', culture: 'Culture' };
const CATEGORY_ICONS = {
  populaires: Flame, quiz: BrainCircuit, puzzle: Puzzle, voyage: MapPinned, culture: Globe2,
  arcade: Gamepad2, kids: Baby, racing: Car, adventure: Compass, fighting: Swords,
  sports: Dumbbell, ball: Target, basketball: Target, battle: Swords, simulation: Bot,
  memory: Layers3, '2048': Grid2X2, 'match-3': Grid3X3, shooter: Target,
  'first-person-shooter': Target, drawing: PenTool, stickman: User, educational: GraduationCap,
  animal: PawPrint, fun: PartyPopper, christmas: TreePine, robots: Bot, retro: Gamepad2, io: Globe2,
};

const FILTER_OPTIONS = {
  difficulty: [['all', 'Toutes'], ['easy', 'Facile'], ['medium', 'Intermédiaire'], ['hard', 'Difficile']],
  duration: [['all', 'Toute durée'], ['short', '≤ 5 min'], ['medium', '6–10 min'], ['long', '> 10 min']],
  device: [['all', 'Tous appareils'], ['mobile', 'Mobile'], ['desktop', 'Clavier']],
  source: [['all', 'Toutes origines'], ['internal', 'iFilino'], ['partner', 'Partenaires']],
};
const FILTER_LABELS = { difficulty: 'Difficulté', duration: 'Durée', device: 'Compatibilité', source: 'Origine' };

const NAV_ITEMS = [
  { key: 'home', label: 'Accueil', to: '/play', icon: null, exact: true },
  { key: 'new', label: 'Nouveautés', to: '/play#new', icon: Sparkles },
  { key: 'trending', label: 'Tendance', to: '/play#trending', icon: Flame },
  { key: 'leaderboard', label: 'Classement', to: '/play/leaderboard', icon: Medal },
  { key: 'rewards', label: 'Récompenses', to: '/play/rewards', icon: Trophy },
];

// catalog (optionnel, fourni uniquement par PlayHomePage) — regroupe toutes
// les commandes de filtrage/tri qui vivaient auparavant dans CatalogControls
// au corps de la page ; la sidebar devient le seul endroit où filtrer.
export default function PlaySidebar({ catalog }) {
  const { collapsed, toggle } = usePlaySidebar();
  const { get } = usePlayApi();
  const [fetchedCategories, setFetchedCategories] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (catalog) return undefined;
    let active = true;
    get('/play/games').then(({ games = [] }) => {
      if (!active) return;
      const counts = new Map();
      games.forEach(game => { const id = getGameSection(game); counts.set(id, (counts.get(id) || 0) + 1); });
      const list = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({ id, count, label: CATEGORY_LABELS[id] || humanizeCategory(id) }));
      setFetchedCategories(list);
    }).catch(() => {});
    return () => { active = false; };
  }, [get, catalog]);

  const categories = catalog?.categories || fetchedCategories;
  const activeCategory = catalog?.activeCategory;

  function handleCategoryClick(id) {
    if (catalog?.onCategoryChange) catalog.onCategoryChange(id);
    else navigate(`/play?category=${id}`);
  }

  return (
    <>
      <button type="button" className="play-sidebar-toggle" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Afficher le menu de navigation' : 'Réduire le menu de navigation'}>
        <Menu size={20}/>
      </button>
      <aside className={`play-sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Navigation iFilino Play">
        <div className="play-sidebar-inner">
          <nav className="play-sidebar-nav">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = item.exact ? location.pathname === '/play' : location.pathname === item.to;
              return (
                <Link key={item.key} to={item.to} className={isActive ? 'active' : ''}>
                  {Icon ? <Icon size={18}/> : <span className="play-sidebar-logo-dot" aria-hidden="true"/>}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {categories.length > 0 && (
            <>
              <div className="play-sidebar-divider">Catégories</div>
              <nav className="play-sidebar-nav play-sidebar-categories">
                {categories.filter(cat => cat.id !== 'all').map(cat => {
                  const Icon = CATEGORY_ICONS[cat.id] || Gamepad2;
                  return (
                    <button key={cat.id} type="button" className={activeCategory === cat.id ? 'active' : ''} aria-pressed={activeCategory === cat.id} onClick={() => handleCategoryClick(cat.id)}>
                      <Icon size={18}/><span>{cat.label}</span><small>{cat.count}</small>
                    </button>
                  );
                })}
              </nav>
            </>
          )}

          {catalog && (
            <>
              <div className="play-sidebar-divider">
                <Filter size={13}/> Filtres
                {catalog.activeFilterCount > 0 && <span className="play-sidebar-filter-count">{catalog.activeFilterCount}</span>}
                {(catalog.activeFilterCount > 0 || activeCategory !== 'all' || Boolean(catalog.query?.trim())) && (
                  <button type="button" className="play-sidebar-reset" onClick={catalog.onReset} aria-label="Réinitialiser les filtres" title="Réinitialiser"><RotateCcw size={13}/></button>
                )}
              </div>
              <div className="play-sidebar-filters">
                {Object.entries(FILTER_OPTIONS).map(([key, options]) => (
                  <label key={key}>
                    <span>{FILTER_LABELS[key]}</span>
                    <select value={catalog.filters[key]} onChange={event => catalog.onFilterChange(key, event.target.value)}>
                      {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                ))}
              </div>

              <div className="play-sidebar-divider">Affichage</div>
              <div className="play-sidebar-view-switch" role="group" aria-label="Mode d’affichage">
                <button type="button" className={catalog.viewMode === 'grid' ? 'active' : ''} aria-pressed={catalog.viewMode === 'grid'} onClick={() => catalog.onViewModeChange('grid')}><LayoutGrid size={16}/>Grille</button>
                <button type="button" className={catalog.viewMode === 'list' ? 'active' : ''} aria-pressed={catalog.viewMode === 'list'} onClick={() => catalog.onViewModeChange('list')}><List size={16}/>Liste</button>
              </div>
              <p className="play-sidebar-result-count" role="status">{catalog.resultCount} jeu{catalog.resultCount === 1 ? '' : 'x'} affiché{catalog.resultCount === 1 ? '' : 's'}</p>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
