import { useEffect } from 'react';
import type { BookItem } from './types';

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  const created = !element;
  if (!element) { element = document.createElement('meta'); document.head.appendChild(element); }
  const previous: Record<string, string | null> = {};
  Object.entries(attributes).forEach(([key, value]) => { previous[key] = element!.getAttribute(key); element!.setAttribute(key, value); });
  return () => {
    if (created) element!.remove();
    else Object.entries(previous).forEach(([key, value]) => (value === null ? element!.removeAttribute(key) : element!.setAttribute(key, value)));
  };
}

/**
 * SEO de la page de présentation d'un livre — même schéma que PlayGameSeo.jsx (title/meta
 * description/OpenGraph/Twitter Card/canonical, mutation directe du <head>, aucune dépendance
 * react-helmet : il n'y en a nulle part ailleurs dans ce projet). Ajoute en plus un JSON-LD
 * schema.org `Book` + `BreadcrumbList`, dans le même esprit que le JSON-LD inline de
 * GameDetailsPage.jsx.
 */
export function BookSeo({ item, language, t }: {
  item: BookItem | null;
  language: string;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  useEffect(() => {
    if (!item) return undefined;
    const title = `${item.title} — ${t('kids.book.illustratedAlbum')} | iFilino Kids`;
    const description = item.seo?.description || item.excerpt || '';
    const canonicalUrl = `${window.location.origin}/kids/${language}/book/${item.slug}`;
    const image = item.image_url || '';
    const oldTitle = document.title;
    document.title = title;

    const cleanups = [
      upsertMeta('meta[name="description"]', { name: 'description', content: description }),
      upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'book' }),
      upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title }),
      upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description }),
      upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl }),
      upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'iFilino Kids' }),
      upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' }),
      upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title }),
      upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description }),
    ];
    if (image) {
      const absoluteImage = new URL(image, window.location.origin).href;
      cleanups.push(upsertMeta('meta[property="og:image"]', { property: 'og:image', content: absoluteImage }));
      cleanups.push(upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: absoluteImage }));
    }

    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const canonicalCreated = !canonical;
    const oldCanonical = canonical?.getAttribute('href') ?? null;
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = canonicalUrl;

    const jsonLd = document.createElement('script');
    jsonLd.type = 'application/ld+json';
    jsonLd.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Book',
          name: item.title,
          description,
          image: image || undefined,
          author: item.metadata?.author ? { '@type': 'Person', name: item.metadata.author } : undefined,
          illustrator: item.metadata?.illustrator ? { '@type': 'Person', name: item.metadata.illustrator } : undefined,
          isbn: item.metadata?.isbn || undefined,
          inLanguage: language,
          numberOfPages: item.metadata?.pageCount || undefined,
          audience: item.metadata?.ageRange ? { '@type': 'PeopleAudience', suggestedMinAge: item.metadata.ageRange } : undefined,
          aggregateRating: item.metadata?.rating?.count
            ? { '@type': 'AggregateRating', ratingValue: item.metadata.rating.average, reviewCount: item.metadata.rating.count }
            : undefined,
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'iFilino Kids', item: `${window.location.origin}/kids/${language}` },
            { '@type': 'ListItem', position: 2, name: t('kids.nav.stories'), item: `${window.location.origin}/kids/${language}/stories` },
            { '@type': 'ListItem', position: 3, name: item.title, item: canonicalUrl },
          ],
        },
      ],
    });
    document.head.appendChild(jsonLd);

    return () => {
      document.title = oldTitle;
      cleanups.reverse().forEach(cleanup => cleanup());
      if (canonicalCreated) canonical!.remove();
      else if (oldCanonical === null) canonical!.removeAttribute('href');
      else canonical!.setAttribute('href', oldCanonical);
      jsonLd.remove();
    };
  }, [item, language, t]);

  return null;
}
