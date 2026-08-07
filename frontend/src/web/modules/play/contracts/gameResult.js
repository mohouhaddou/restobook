export const GAME_RESULT_STATUS = Object.freeze({ COMPLETED: 'completed', ABANDONED: 'abandoned' });
export const GAME_DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, finite(value, min)));

export function createGameResult(input = {}) {
  const status = Object.values(GAME_RESULT_STATUS).includes(input.status) ? input.status : GAME_RESULT_STATUS.COMPLETED;
  const difficulty = GAME_DIFFICULTIES.includes(input.difficulty) ? input.difficulty : 'medium';
  return Object.freeze({
    gameId: String(input.gameId || ''),
    score: Math.round(clamp(input.score, 0, 100000)),
    duration: Math.round(clamp(input.duration ?? input.durationSeconds, 0, 86400)),
    durationSeconds: Math.round(clamp(input.duration ?? input.durationSeconds, 0, 86400)),
    status,
    won: input.won !== false && status === GAME_RESULT_STATUS.COMPLETED,
    difficulty,
    stats: input.stats && typeof input.stats === 'object' && !Array.isArray(input.stats) ? input.stats : {},
    playedAt: input.playedAt || new Date().toISOString(),
  });
}

export function isGameResult(value) {
  return Boolean(value && typeof value.gameId === 'string' && Number.isInteger(value.score) && Number.isInteger(value.durationSeconds) && GAME_DIFFICULTIES.includes(value.difficulty) && Object.values(GAME_RESULT_STATUS).includes(value.status));
}
