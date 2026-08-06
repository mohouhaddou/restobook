import { useEffect } from 'react';

function upsert(selector, tagName, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) { element = document.createElement(tagName); document.head.appendChild(element); }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
}
function absoluteUrl(value) { try { return new URL(value, window.location.origin).href; } catch { return value; } }

/** Synchronizes metadata after React Router navigation; server metadata remains authoritative. */
export default function SeoHead({ title, description, canonicalPath, image = '/brand/ifilino_kids.png', type = 'website', language = 'en', alternates = [], robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1', schemas = [] }) {
  useEffect(() => {
    if (!title || !description || !canonicalPath) return undefined;
    const canonical = absoluteUrl(canonicalPath); const socialImage = absoluteUrl(image);
    document.title = title;
    upsert('meta[name="description"]', 'meta', { name:'description', content:description });
    upsert('meta[name="robots"]', 'meta', { name:'robots', content:robots });
    upsert('link[rel="canonical"]', 'link', { rel:'canonical', href:canonical });
    const entries = { 'og:site_name':'iFilino Kids', 'og:type':type, 'og:title':title, 'og:description':description, 'og:url':canonical, 'og:image':socialImage, 'og:image:alt':title, 'og:locale':language === 'fr' ? 'fr_FR' : language === 'ar' ? 'ar_MA' : 'en_US' };
    Object.entries(entries).forEach(([property, content]) => upsert(`meta[property="${property}"]`, 'meta', { property, content }));
    [['twitter:card','summary_large_image'],['twitter:title',title],['twitter:description',description],['twitter:image',socialImage]].forEach(([name,content]) => upsert(`meta[name="${name}"]`, 'meta', { name, content }));
    document.head.querySelectorAll('link[data-kids-hreflang],script[data-kids-schema]').forEach(node => node.remove());
    alternates.forEach(({ language: alternateLanguage, path }) => { const link=document.createElement('link'); link.rel='alternate'; link.hreflang=alternateLanguage; link.href=absoluteUrl(path); link.dataset.kidsHreflang='true'; document.head.appendChild(link); });
    schemas.filter(Boolean).forEach(schema => { const script=document.createElement('script'); script.type='application/ld+json'; script.dataset.kidsSchema='true'; script.textContent=JSON.stringify(schema); document.head.appendChild(script); });
    return () => document.head.querySelectorAll('link[data-kids-hreflang],script[data-kids-schema]').forEach(node => node.remove());
  }, [title, description, canonicalPath, image, type, language, robots, JSON.stringify(alternates), JSON.stringify(schemas)]);
  return null;
}
export function kidsAlternates(pathAfterLanguage = '') { const suffix=pathAfterLanguage ? `/${String(pathAfterLanguage).replace(/^\/+/, '')}` : ''; return ['en','fr','ar'].map(language => ({ language, path:`/kids/${language}${suffix}` })).concat({ language:'x-default', path:`/kids/en${suffix}` }); }
