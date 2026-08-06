import { useEffect } from 'react';

const upsertMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  const created = !element;
  if (!element) { element = document.createElement('meta'); document.head.appendChild(element); }
  const previous = {};
  Object.entries(attributes).forEach(([key, value]) => { previous[key] = element.getAttribute(key); element.setAttribute(key, value); });
  return () => {
    if (created) element.remove();
    else Object.entries(previous).forEach(([key, value]) => value === null ? element.removeAttribute(key) : element.setAttribute(key, value));
  };
};

export default function PlayGameSeo({ game }) {
  useEffect(() => {
    if (!game) return undefined;
    const title = `${game.name} — Jouer gratuitement | iFilino Play`;
    const description = game.description || `Jouez gratuitement à ${game.name} sur iFilino Play.`;
    const canonicalUrl = `${window.location.origin}/play/${game.slug}`;
    const image = game.thumbnail || game.image || '';
    const oldTitle = document.title;
    document.title = title;
    const cleanups = [
      upsertMeta('meta[name="description"]', { name: 'description', content: description }),
      upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' }),
      upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title }),
      upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description }),
      upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl }),
      upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'iFilino Play' }),
      upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' }),
      upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title }),
      upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description }),
    ];
    if (image) {
      const absoluteImage = new URL(image, window.location.origin).href;
      cleanups.push(upsertMeta('meta[property="og:image"]', { property: 'og:image', content: absoluteImage }));
      cleanups.push(upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: absoluteImage }));
    }
    let canonical = document.head.querySelector('link[rel="canonical"]');
    const canonicalCreated = !canonical;
    const oldCanonical = canonical?.getAttribute('href');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = canonicalUrl;
    return () => {
      document.title = oldTitle;
      cleanups.reverse().forEach(cleanup => cleanup());
      if (canonicalCreated) canonical.remove();
      else if (oldCanonical === null) canonical.removeAttribute('href');
      else canonical.setAttribute('href', oldCanonical);
    };
  }, [game]);
  return null;
}
