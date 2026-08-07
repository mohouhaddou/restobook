import { BadgeCheck, Blocks, BrainCircuit, BrickWall, CircleDot, Gamepad2, Globe2, Grid2X2, Layers3, MapPinned, Palette, Puzzle, Route, Target, Zap } from 'lucide-react';

// Métadonnées présentationnelles par game_type (icône/couleur/section de la
// page d'accueil). Les données réelles (nom, description) viennent de l'API.
export const GAME_TYPE_META = {
  '2048':         { icon: Grid2X2, color: '#D97706', section: 'populaires' },
  memory:         { icon: BrainCircuit, color: '#0284C7', section: 'populaires' },
  puzzle_image:   { icon: Puzzle, color: '#7C3AED', section: 'puzzle' },
  quiz:           { icon: BadgeCheck, color: '#EA580C', section: 'quiz' },
  true_false:     { icon: CircleDot, color: '#059669', section: 'quiz' },
  geo_quiz:       { icon: Globe2, color: '#0891B2', section: 'culture' },
  guess_place:    { icon: MapPinned, color: '#E11D48', section: 'voyage' },
  memory_cards:   { icon: Layers3, color: '#7C3AED', section: 'populaires' },
  reaction_test:  { icon: Zap, color: '#D97706', section: 'populaires' },
  color_match:    { icon: Palette, color: '#DB2777', section: 'populaires' },
  bubble_pop:     { icon: CircleDot, color: '#2563EB', section: 'populaires' },
  brick_smash:    { icon: BrickWall, color: '#DC2626', section: 'populaires' },
  tower_stack:    { icon: Blocks, color: '#4F46E5', section: 'populaires' },
  penalty_master: { icon: Target, color: '#059669', section: 'populaires' },
  snake:          { icon: Route, color: '#16A34A', section: 'populaires' },
};

export function getGameMeta(gameType) {
  return GAME_TYPE_META[gameType] || { icon: Gamepad2, color: '#64748B', section: 'populaires' };
}

// Jeux GamePix (game_type unique 'gamepix') : le vrai découpage vient de leur
// propre `category` (match-3, arcade, kids, racing…), pas du game_type — sinon
// les 50 jeux partenaires s'entassent tous dans la même section "Populaires".
export function getGameSection(game) {
  if (game?.game_type === 'gamepix' && game?.category) return game.category;
  return getGameMeta(game?.game_type).section;
}

export function humanizeCategory(slug) {
  return String(slug || '').split('-').filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
