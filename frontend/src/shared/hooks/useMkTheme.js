import { useState } from 'react';

// Thème clair/sombre du design system client (--mk-*), partagé par
// MarketplacePage et le Dashboard Consommateur — persisté dans localStorage.
export function useMkTheme() {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('mk-theme') ||
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
  const toggle = () => setTheme(t => {
    const next = t === 'dark' ? 'light' : 'dark';
    localStorage.setItem('mk-theme', next);
    return next;
  });
  return [theme, toggle];
}
