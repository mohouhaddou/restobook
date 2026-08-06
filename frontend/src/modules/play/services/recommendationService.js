const text = value => String(value || '').trim().toLocaleLowerCase();
const duration = game => Number(game?.averageDuration ?? game?.duration ?? 0) || 0;
const category = game => text(game?.category ?? game?.game_type ?? game?.gameType ?? 'other');

export function rankGameRecommendations({ currentGame, games = [], history = [], favoriteSlugs = [], limit = 4 }) {
  if (!currentGame) return [];
  const favorites = new Set(favoriteSlugs);
  const recent = new Map();
  history.forEach((item, index) => { const slug = item?.game?.slug || item?.slug; if (slug && !recent.has(slug)) recent.set(slug, index); });
  const currentTags = new Set((currentGame.tags || []).map(text));
  const unique = new Map();
  games.forEach(game => { if (game?.slug && game.slug !== currentGame.slug && !unique.has(game.slug)) unique.set(game.slug, game); });
  return [...unique.values()].map(game => {
    let score = 0;
    if (category(game) === category(currentGame)) score += 42;
    const sharedTags = (game.tags || []).map(text).filter(tag => currentTags.has(tag)).length;
    score += Math.min(18, sharedTags * 6);
    const gap = Math.abs(duration(game) - duration(currentGame));
    score += Math.max(0, 18 - gap * 3);
    score += Math.min(14, Math.log10((Number(game.playCount) || 0) + 1) * 4);
    score += Math.max(0, Math.min(10, Number(game.rating || 0) * 2));
    if (favorites.has(game.slug)) score += 12;
    if (!recent.has(game.slug)) score += 8;
    else score -= Math.max(2, 12 - recent.get(game.slug));
    return { game, score };
  }).sort((a, b) => b.score - a.score || String(a.game.slug).localeCompare(String(b.game.slug))).slice(0, Math.max(1, limit)).map(item => item.game);
}

export default rankGameRecommendations;
