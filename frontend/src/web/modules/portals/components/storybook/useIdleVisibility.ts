import { useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'wheel'] as const;

/**
 * true tant que l'utilisateur est actif, false après `idleMs` sans la moindre interaction —
 * sert à faire disparaître le chrome (header, barre de narration) en lecture plein écran, comme
 * les contrôles d'un lecteur vidéo. Écoute au niveau window : deux instances de ce hook (une pour
 * le header, une pour la barre de narration) se retrouvent synchronisées de fait, sans état
 * partagé, puisqu'elles réagissent aux mêmes événements avec le même délai.
 */
export function useIdleVisibility(idleMs = 2800): boolean {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function reset() {
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), idleMs);
    }
    reset();
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, reset, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [idleMs]);

  return visible;
}
