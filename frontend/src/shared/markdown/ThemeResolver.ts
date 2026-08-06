import { ThemeRegistry } from './ThemeRegistry';
import type { MarkdownTheme } from './MarkdownTheme';

const FALLBACK_THEME_ID = 'discover';

/**
 * Seul point de décision "quel thème pour quel module". Le moduleId vient de
 * manifest.module (import IA) ou, côté page, du module déjà connu par la page
 * elle-même (Discover/Sports/Kids) — jamais déduit par le renderer.
 */
function resolve(moduleId: string | null | undefined): MarkdownTheme {
  const theme = moduleId ? ThemeRegistry.get(moduleId) : undefined;
  if (theme) return theme;
  const fallback = ThemeRegistry.get(FALLBACK_THEME_ID);
  if (!fallback) {
    throw new Error(`ThemeResolver: aucun thème enregistré, même pas le thème de repli "${FALLBACK_THEME_ID}".`);
  }
  return fallback;
}

/** Déduit le module depuis la route courante, pour les pages qui préfèrent ne pas le passer explicitement. */
function resolveFromPathname(pathname: string): MarkdownTheme {
  const segment = pathname.split('/').filter(Boolean)[0] || '';
  return resolve(segment);
}

export const ThemeResolver = { resolve, resolveFromPathname };
