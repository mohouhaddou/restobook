import { useCallback, useMemo, useState } from 'react';

const STORAGE_KEY = 'ifilino-kids-explorer-progress';
export const EXPLORER_BADGE_THRESHOLDS = [1, 3, 5, 10, 20];

function readCompleted() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * Progression "explorateur" sans compte — mêmes principes que useStoryFavorite
 * (frontend/src/modules/portals/hooks/useStoryEngagement.ts) : localStorage uniquement, jamais
 * de synchronisation serveur. Un enfant qui explore Study/Encyclopedia sans se connecter voit
 * quand même ses badges, propres à cet appareil/navigateur.
 */
export function useExplorerProgress() {
  const [completed, setCompleted] = useState(readCompleted);

  const markCompleted = useCallback((slug) => {
    if (!slug) return { justUnlockedTier: null, count: completed.length };
    let justUnlockedTier = null;
    let nextCount = completed.length;
    setCompleted(current => {
      if (current.includes(slug)) { nextCount = current.length; return current; }
      const next = [...current, slug];
      nextCount = next.length;
      if (EXPLORER_BADGE_THRESHOLDS.includes(next.length)) justUnlockedTier = next.length;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return { justUnlockedTier, count: nextCount };
  }, [completed]);

  const count = completed.length;
  const badgeTier = useMemo(() => [...EXPLORER_BADGE_THRESHOLDS].reverse().find(t => count >= t) || 0, [count]);
  const nextThreshold = useMemo(() => EXPLORER_BADGE_THRESHOLDS.find(t => t > count), [count]);

  return { completed, count, badgeTier, nextThreshold, markCompleted };
}
