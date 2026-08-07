export const GAME_SOURCES = Object.freeze({
  INTERNAL: 'internal',
  PARTNER: 'partner',
});

export const GAME_LAUNCH_METHODS = Object.freeze({
  REACT: 'react',
  PHASER: 'phaser',
  EMBED: 'embed',
  REDIRECT: 'redirect',
  SDK: 'sdk',
});

const VALID_SOURCES = new Set(Object.values(GAME_SOURCES));
const VALID_LAUNCH_METHODS = new Set(Object.values(GAME_LAUNCH_METHODS));

const cleanText = (value, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const cleanNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const cleanBoolean = (value, fallback = false) => typeof value === 'boolean' ? value : fallback;
const cleanList = value => Array.isArray(value) ? [...new Set(value.filter(Boolean).map(String))] : [];

export function normalizeCatalogGame(input, providerId = input?.providerId) {
  if (!input || typeof input !== 'object') throw new TypeError('CatalogGame must be an object');
  const id = cleanText(String(input.id ?? input.slug ?? ''));
  const slug = cleanText(input.slug, id);
  const resolvedProviderId = cleanText(providerId);
  if (!id || !slug || !resolvedProviderId) throw new TypeError('CatalogGame requires id, slug and providerId');

  const source = VALID_SOURCES.has(input.source) ? input.source : GAME_SOURCES.INTERNAL;
  const launchMethod = VALID_LAUNCH_METHODS.has(input.launchMethod) ? input.launchMethod : GAME_LAUNCH_METHODS.REACT;
  const mobile = cleanBoolean(input.compatibility?.mobile ?? input.mobile, true);
  const keyboard = cleanBoolean(input.compatibility?.keyboard ?? input.keyboard, false);
  const fullscreen = cleanBoolean(input.compatibility?.fullscreen ?? input.fullscreen, true);

  return Object.freeze({
    id,
    slug,
    title: cleanText(input.title ?? input.name, slug),
    name: cleanText(input.name ?? input.title, slug),
    description: cleanText(input.description),
    providerId: resolvedProviderId,
    source,
    launchMethod,
    category: cleanText(input.category, 'other'),
    tags: cleanList(input.tags),
    thumbnail: cleanText(input.thumbnail ?? input.cover),
    heroImage: cleanText(input.heroImage ?? input.thumbnail ?? input.cover),
    difficulty: cleanText(input.difficulty, 'medium'),
    averageDuration: Math.max(0, cleanNumber(input.averageDuration ?? input.duration)),
    compatibility: Object.freeze({ mobile, keyboard, fullscreen }),
    rating: Math.min(5, Math.max(0, cleanNumber(input.rating))),
    playCount: Math.max(0, cleanNumber(input.playCount)),
    ads: cleanBoolean(input.ads),
    license: cleanText(input.license, source === GAME_SOURCES.INTERNAL ? 'iFilino' : ''),
    status: cleanText(input.status, 'active'),
    addedAt: input.addedAt || null,
    launchConfig: Object.freeze({ ...(input.launchConfig || {}) }),
    original: input,
  });
}

export function isCatalogGame(value) {
  try {
    normalizeCatalogGame(value);
    return true;
  } catch {
    return false;
  }
}
