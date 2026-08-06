'use strict';

// Parsing Markdown réservé au détail (withBody) — coûteux et inutile pour les
// listes/cartes, qui n'affichent que l'excerpt. Même moteur que Discover, voir
// backend/src/shared/markdown/markdownEngine.js.
const { parseMarkdown } = require('../../shared/markdown/markdownEngine');
const { authorizePublication, applyPublicationAccess } = require('./freemium/accessPolicy');

/**
 * Contrat `metadata` (colonne JSON libre, portal_contents) pour un livre Kids (content_type
 * 'stories') — tous les champs sont optionnels, absents par défaut ; le frontend (BookLandingPage
 * et les composants Book*) les traite comme potentiellement vides, jamais codés en dur. Documenté
 * ici plutôt qu'imposé par une migration : `metadata` reste un JSON libre, écrit aujourd'hui par
 * l'éditeur superadmin existant (voir adminRoutes.js), pas de nouvelle colonne nécessaire.
 *
 * {
 *   subtitle, author, illustrator, narrator, translator, ageRange ("6-9 ans"),
 *   isbn, version, licence, wordCount, pageCount, illustrationCount, readingMinutes,
 *   pdf: { url, free, price, currency }, audio: { url, durationSeconds, free, price, currency,
 *   narrator }, previewPages: [{ page, image }], characters: [{ name, image,
 *   description, traits: [], colors: [], accessories: [] }], learningGoals: [{ icon, label }],
 *   values: [{ icon, label }], coloringPack: { url, previewImages: [] },
 *   activitiesPack: { free, price, currency, activities: [{ type, label, free }] },
 *   relatedProducts: [{ type, label, price, currency, url }], recommendedBooks: [slug],
 *   rating: { average, count }, reviews: [{ author, rating, comment, date }],
 * }
 */
function serializeContent(content, translation, { withBody = false, isAuthenticated = false } = {}) {
  const item = content.toJSON ? content.toJSON() : content;
  const tr = translation ? (translation.toJSON ? translation.toJSON() : translation) : null;
  const title = tr?.title || null;
  const authorization = authorizePublication(item, { isAuthenticated });
  const sourceBody = tr?.body || null;
  const bodyMarkdown = applyPublicationAccess(sourceBody, authorization);
  const parsed = withBody && bodyMarkdown ? parseMarkdown(bodyMarkdown, { title }) : null;
  return {
    id: item.id,
    translation_group_id: item.id,
    portal: item.portal,
    type: item.content_type,
    slug: tr?.slug || item.slug,
    language: tr?.language || null,
    title,
    excerpt: tr?.excerpt || null,
    body: withBody ? bodyMarkdown : undefined,
    ...(parsed ? { blocks: parsed.blocks, toc: parsed.toc, readingTime: parsed.readingTime } : {}),
    image_url: item.image_url,
    category: item.category,
    metadata: tr?.metadata || item.metadata || {},
    localized_metadata: tr?.metadata || null,
    featured: item.featured,
    isPremium: authorization.isPremium,
    previewLength: authorization.previewLength,
    premiumBadge: authorization.premiumBadge,
    access: { hasFullAccess: authorization.hasFullAccess, isPreview: authorization.isPreview },
    published_at: item.published_at,
    view_count: item.view_count,
    seo: {
      title: tr?.seo_title || title,
      description: tr?.seo_description || tr?.excerpt || null,
      keywords: tr?.seo_keywords || [],
    },
    localized_slug: tr?.slug || null,
    localized_title: title,
    localized_summary: tr?.excerpt || null,
  };
}

module.exports = { serializeContent };
