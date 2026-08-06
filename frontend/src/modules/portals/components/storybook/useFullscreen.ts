import { useCallback, useEffect, useState, type RefObject } from 'react';

/** Plein écran natif (Fullscreen API) sur le conteneur fourni — jamais sur tout le document,
 * pour que le reste de l'application reste inchangé si l'utilisateur navigue ailleurs. */
export function useFullscreen(containerRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onChange() { setIsFullscreen(document.fullscreenElement === containerRef.current); }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, [containerRef]);

  return { isFullscreen, toggle };
}
