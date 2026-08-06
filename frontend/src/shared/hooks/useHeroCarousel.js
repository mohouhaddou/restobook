import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../api';

export const AUTOPLAY_MS = 5000;

/**
 * État + comportement partagés entre les carousels Hero (marketplace et
 * commerce) : fetch des slides, autoplay pausable, tracking d'impression
 * (une fois par slide affiché), swipe, et clic CTA. Chaque appelant fournit
 * ses propres URLs (marketplace vs commerce ont des endpoints distincts) et
 * décide s'il stocke le clic pour l'attribution (marketplace uniquement).
 */
export function useHeroCarousel({ fetchUrl, reloadKey, headers, impressionPath, clickPath, onNavigate, clickStorageKey }) {
  const navigate = useNavigate();
  const [slides, setSlides] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const pausedRef = useRef(false);
  const seenImpressions = useRef(new Set());
  const timerRef = useRef(null);

  useEffect(() => {
    setSlides([]); setIdx(0); setLoaded(false);
    seenImpressions.current = new Set();
    if (!fetchUrl) { setLoaded(true); return; }
    fetch(API(fetchUrl), { headers: headers || {} })
      .then(r => r.json())
      .then(d => setSlides(d.slides || []))
      .catch(() => setSlides([]))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl, reloadKey]);

  useEffect(() => {
    if (slides.length < 2) return;
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) setIdx(i => (i + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timerRef.current);
  }, [slides.length]);

  const current = slides[idx] || null;

  // Impression — une fois par slide affiché, jamais reprise en boucle.
  useEffect(() => {
    if (!current || seenImpressions.current.has(current.id)) return;
    seenImpressions.current.add(current.id);
    if (impressionPath) fetch(API(impressionPath(current.id)), { method: 'POST' }).catch(() => {});
  }, [current, impressionPath]);

  const goTo = useCallback((i) => setIdx(((i % slides.length) + slides.length) % slides.length), [slides.length]);

  function handleDragEnd(e, info) {
    pausedRef.current = false;
    if (info.offset.x < -60) goTo(idx + 1);
    else if (info.offset.x > 60) goTo(idx - 1);
  }

  function handleCtaClick(slide) {
    if (clickStorageKey) {
      try { localStorage.setItem(clickStorageKey, JSON.stringify({ slide_id: slide.id, ts: new Date().toISOString() })); } catch {}
    }
    if (clickPath) fetch(API(clickPath(slide.id)), { method: 'POST' }).catch(() => {});
    if (onNavigate) onNavigate(slide);
    else if (slide.cta_url) {
      if (slide.cta_type === 'external_url') window.open(slide.cta_url, '_blank', 'noopener');
      else navigate(slide.cta_url);
    }
  }

  return { slides, idx, current, loaded, pausedRef, goTo, handleDragEnd, handleCtaClick };
}
