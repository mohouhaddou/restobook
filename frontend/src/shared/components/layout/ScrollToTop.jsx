import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const useIsoLayoutEffect = typeof window !== 'undefined'
  ? React.useLayoutEffect
  : React.useEffect;

function resetScrollPosition() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.documentElement.scrollLeft = 0;
  document.body.scrollTop = 0;
  document.body.scrollLeft = 0;

  document.querySelectorAll('[data-scroll-root]').forEach(node => {
    if (typeof node.scrollTo === 'function') {
      node.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } else {
      node.scrollTop = 0;
      node.scrollLeft = 0;
    }
  });
}

/**
 * Gives every client-side navigation the same starting point as a full page load.
 * Browser scroll restoration is disabled because React Router keeps the document
 * mounted while routes change.
 */
export function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) {
      return undefined;
    }

    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useIsoLayoutEffect(() => {
    resetScrollPosition();
    const frame = window.requestAnimationFrame(resetScrollPosition);

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.search]);

  return null;
}
