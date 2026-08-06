import { useEffect, useRef } from 'react';

/**
 * Scroll infini — IntersectionObserver sur une sentinelle rendue en bas de
 * la grille. `rootMargin: '400px'` précharge avant que la sentinelle ne soit
 * réellement visible, pour éviter un flash de chargement perceptible.
 * S'attache au même pattern page/pages/append déjà utilisé par
 * MarketplacePage.jsx — remplace juste le bouton "Voir plus" par un
 * déclenchement automatique.
 */
export function useInfiniteScroll({ hasMore, loading, onLoadMore }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onLoadMore();
    }, { rootMargin: '400px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  return sentinelRef;
}
