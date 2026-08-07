import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ifilino-play-theme';

// Thème scoped à iFilino Play — attribut posé sur <html>, lu par les
// sélecteurs [data-play-theme="light"] .play-page dans play.css. Dark par
// défaut : n'affecte jamais le thème (toujours clair) du reste de RestoBook.
export default function usePlayTheme() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-play-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    return () => document.documentElement.removeAttribute('data-play-theme');
  }, [theme]);

  const toggle = useCallback(() => setTheme(current => (current === 'dark' ? 'light' : 'dark')), []);

  return { theme, toggle };
}
