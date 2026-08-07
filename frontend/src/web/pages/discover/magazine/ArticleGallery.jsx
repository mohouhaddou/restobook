import React from 'react';
import { ASSET } from '../../../../api';

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function imageKeys(src) {
  const clean = String(src || '').split(/[?#]/)[0].replace(/^https?:\/\/[^/]+/i, '');
  const name = clean.split('/').pop();
  return [clean, name].filter(Boolean);
}

function imageLabelsFromHtml(html) {
  const labels = new Map();
  String(html || '').replace(/<img\b[^>]*>/gi, tag => {
    const attrs = {};
    tag.replace(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g, (_, name, quote, value) => {
      attrs[name.toLowerCase()] = decodeHtml(value);
      return '';
    });
    if (attrs.src && attrs.alt) {
      imageKeys(attrs.src).forEach(key => labels.set(key, attrs.alt));
    }
    return '';
  });
  return labels;
}

function isDefaultIllustrationText(value) {
  return /^illustration\s+\d+$/i.test(String(value || '').trim());
}

function captionForImage(img, index, markdownLabels) {
  const fromMarkdown = imageKeys(img?.url).map(key => markdownLabels.get(key)).find(Boolean);
  const savedAlt = String(img?.alt_text || '').trim();
  const savedTitle = String(img?.title || '').trim();
  if (fromMarkdown && !isDefaultIllustrationText(fromMarkdown)) return fromMarkdown;
  if (savedAlt && !isDefaultIllustrationText(savedAlt)) return savedAlt;
  if (savedTitle && !isDefaultIllustrationText(savedTitle)) return savedTitle;
  return savedAlt || fromMarkdown || savedTitle || `Illustration ${index + 1}`;
}

// Illustrations générées par le moteur IA (image_assets.illustrations,
// voir aiImageService.js) — produites et sauvegardées mais jusqu'ici jamais
// affichées nulle part (seul le hero apparaissait). Composant pur, partagé
// SSR + CSR comme le reste des briques magazine.
export default function ArticleGallery({ illustrations, bodyHtml = '' }) {
  if (!illustrations?.length) return null;
  const markdownLabels = imageLabelsFromHtml(bodyHtml);
  return (
    <section className="ifm-gallery" aria-label="Illustrations de l'article">
      <div className="ifm-gallery-grid">
        {illustrations.map((img, index) => {
          const caption = captionForImage(img, index, markdownLabels);
          return (
            <figure key={img.key || img.url} className="ifm-gallery-item">
              <img src={ASSET(img.url)} alt={caption} loading="lazy" />
              {caption && <figcaption>{caption}</figcaption>}
            </figure>
          );
        })}
      </div>
    </section>
  );
}
