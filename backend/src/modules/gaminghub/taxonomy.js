'use strict';

/**
 * Helpers de lecture pour gaming_categories/gaming_tags — équivalent
 * fonctionnel de discover/rubriques.js, mais les catégories du Gaming Hub
 * sont persistées en table (créables par un admin sans déploiement) plutôt
 * que figées dans le code.
 */
const { GamingCategory, GamingTag } = require('../../../models');

const LANGUAGES = ['ar', 'fr', 'en'];

function categoryLabel(category, language = 'fr') {
  const lang = LANGUAGES.includes(language) ? language : 'fr';
  return category[`label_${lang}`] || category.label_fr || category.slug;
}

async function listCategories(language = 'fr') {
  const categories = await GamingCategory.findAll({ order: [['sort_order', 'ASC']] });
  return categories.map(c => ({
    id: c.id,
    slug: c.slug,
    label: categoryLabel(c, language),
    icon: c.icon,
  }));
}

async function listTags(limit = 50) {
  const tags = await GamingTag.findAll({ order: [['label', 'ASC']], limit });
  return tags.map(t => ({ id: t.id, slug: t.slug, label: t.label }));
}

module.exports = { categoryLabel, listCategories, listTags };
