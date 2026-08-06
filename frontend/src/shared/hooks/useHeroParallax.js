import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, useTransform } from 'framer-motion';

function canParallax() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  // pointer:fine + hover:hover exclut naturellement le tactile (mobile/tablette),
  // signal plus fiable qu'un simple breakpoint de largeur pour "y a-t-il une souris".
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return false;
  return true;
}

/**
 * Parallax au mouvement de la souris — deux profondeurs (fond photo, décor/
 * objets au premier plan), transform-only (x/y) donc GPU-friendly, jamais
 * activé sur tactile ni avec prefers-reduced-motion. Toujours discret : le
 * fond bouge à peine, le décor un peu plus, pour une sensation de profondeur
 * sans jamais devenir une animation agressive.
 */
export function useHeroParallax(containerRef) {
  const enabledRef = useRef(canParallax());
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, { stiffness: 60, damping: 20, mass: 0.5 });
  const springY = useSpring(rawY, { stiffness: 60, damping: 20, mass: 0.5 });

  useEffect(() => {
    if (!enabledRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    function handleMove(e) {
      const rect = el.getBoundingClientRect();
      rawX.set(((e.clientX - rect.left) / rect.width - 0.5) * 2);
      rawY.set(((e.clientY - rect.top) / rect.height - 0.5) * 2);
    }
    function handleLeave() { rawX.set(0); rawY.set(0); }
    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, [containerRef, rawX, rawY]);

  const bgX = useTransform(springX, v => v * 6);
  const bgY = useTransform(springY, v => v * 6);
  const fgX = useTransform(springX, v => v * 16);
  const fgY = useTransform(springY, v => v * 16);

  return { bgX, bgY, fgX, fgY };
}
