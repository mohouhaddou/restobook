import { lazy } from 'react';

export const GAMES_REGISTRY = Object.freeze([
  {
    id: 'memory-cards', slug: 'memory-cards', gameType: 'memory_cards', category: 'memory', engine: 'react',
    titleKey: 'play.games.memory.title', descriptionKey: 'play.games.memory.description', howToKey: 'play.games.memory.how',
    difficulty: 'medium', duration: 4, cover: null, status: 'active', addedAt: '2026-07-20',
    component: lazy(() => import('../games/phase-a/MemoryCardsGame.jsx')), options: { difficulties: ['easy', 'medium', 'hard'] },
  },
  {
    id: 'reaction-test', slug: 'reaction-test', gameType: 'reaction_test', category: 'quick', engine: 'react',
    titleKey: 'play.games.reaction.title', descriptionKey: 'play.games.reaction.description', howToKey: 'play.games.reaction.how',
    difficulty: 'easy', duration: 2, cover: null, status: 'active', addedAt: '2026-07-20',
    component: lazy(() => import('../games/phase-a/ReactionTestGame.jsx')), options: { rounds: 5 },
  },
  {
    id: 'color-match', slug: 'color-match', gameType: 'color_match', category: 'quick', engine: 'react',
    titleKey: 'play.games.color.title', descriptionKey: 'play.games.color.description', howToKey: 'play.games.color.how',
    difficulty: 'medium', duration: 3, cover: null, status: 'active', addedAt: '2026-07-20',
    component: lazy(() => import('../games/phase-a/ColorMatchGame.jsx')), options: { rounds: 12, accessibleMode: true },
  },
  {
    id: 'bubble-pop', slug: 'bubble-pop', gameType: 'bubble_pop', category: 'arcade', engine: 'phaser',
    titleKey: 'play.games.bubble.title', descriptionKey: 'play.games.bubble.description', howToKey: 'play.games.bubble.how', difficulty: 'medium', duration: 6, cover: null, status: 'active', addedAt: '2026-07-20',
    component: lazy(() => import('../games/phase-c/BubblePopGame.jsx')), options: { portrait: true },
  },
  {
    id: 'brick-smash', slug: 'brick-smash', gameType: 'brick_smash', category: 'arcade', engine: 'phaser',
    titleKey: 'play.games.brick.title', descriptionKey: 'play.games.brick.description', howToKey: 'play.games.brick.how', difficulty: 'medium', duration: 7, cover: null, status: 'active', addedAt: '2026-07-20',
    component: lazy(() => import('../games/phase-c/BrickSmashGame.jsx')), options: { levels: 3 },
  },
  {
    id: 'tower-stack', slug: 'tower-stack', gameType: 'tower_stack', category: 'arcade', engine: 'phaser',
    titleKey: 'play.games.tower.title', descriptionKey: 'play.games.tower.description', howToKey: 'play.games.tower.how', difficulty: 'medium', duration: 5, cover: null, status: 'active', addedAt: '2026-07-20',
    component: lazy(() => import('../games/phase-d/TowerStackGame.jsx')), options: { portrait: true },
  },
  {
    id: 'penalty-master', slug: 'penalty-master', gameType: 'penalty_master', category: 'sports', engine: 'phaser',
    titleKey: 'play.games.penalty.title', descriptionKey: 'play.games.penalty.description', howToKey: 'play.games.penalty.how', difficulty: 'medium', duration: 4, cover: null, status: 'active', addedAt: '2026-07-20',
    component: lazy(() => import('../games/phase-d/PenaltyMasterGame.jsx')), options: { modes: ['striker', 'keeper'] },
  },
  {
    id: 'snake', slug: 'snake', gameType: 'snake', category: 'arcade', engine: 'phaser',
    titleKey: 'play.games.snake.title', descriptionKey: 'play.games.snake.description', howToKey: 'play.games.snake.how', difficulty: 'medium', duration: 6, cover: null, status: 'active', addedAt: '2026-07-20',
    component: lazy(() => import('../games/phase-e/SnakeGame.jsx')), options: { keyboard: true, touch: true },
  },
]);

export const getRegistryGame = slug => GAMES_REGISTRY.find(game => game.slug === slug && game.status === 'active') || null;
export const listRegistryGames = () => GAMES_REGISTRY.filter(game => game.status === 'active');
export function localizeRegistryGame(game, t) {
  return { ...game, name: t(game.titleKey), title: t(game.titleKey), description: t(game.descriptionKey), howTo: t(game.howToKey), game_type: game.gameType, isLocal: true };
}
