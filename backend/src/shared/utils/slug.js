'use strict';

// Helper de slug générique — extrait de auth/orgProvisioning.js (qui ne
// gérait que Organization) pour être réutilisable par City/Category/MenuItem
// et tout futur modèle SEO, sans dupliquer la logique de normalisation.
function slugify(str, maxLen = 60) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

/**
 * Génère un slug unique pour `Model` à partir de `base`.
 * - `where` : conditions additionnelles d'unicité (ex: { vertical: 'restaurant' })
 * - `disambiguator` : texte ajouté avant le suffixe numérique en cas de collision
 *   (ex: nom du commerce pour un plat) plutôt qu'un simple `-1`, `-2`...
 */
async function generateUniqueSlug(Model, base, { where = {}, maxLen = 191, disambiguator = null } = {}) {
  const root = slugify(base, maxLen) || 'item';
  if (!(await Model.findOne({ where: { ...where, slug: root } }))) return root;

  if (disambiguator) {
    const withDisambiguator = slugify(`${root}-${disambiguator}`, maxLen);
    if (!(await Model.findOne({ where: { ...where, slug: withDisambiguator } }))) return withDisambiguator;
  }

  let n = 1;
  let candidate = `${root}-${n}`;
  while (await Model.findOne({ where: { ...where, slug: candidate } })) {
    n++;
    candidate = `${root}-${n}`;
  }
  return candidate;
}

module.exports = { slugify, generateUniqueSlug };
