'use strict';

// Réutilise le service Discover existant plutôt que de dupliquer une requête
// DB — le puzzle pioche uniquement dans les articles déjà publiés avec une
// image de couverture.
const { listArticles } = require('../../discover/articleService');

async function listPuzzleImages({ limit = 20, language = 'fr' } = {}) {
  const { articles } = await listArticles({ limit, language });
  return articles
    .filter(a => a.cover_image_url)
    .map(a => ({
      articleId: a.article_id,
      slug: a.slug,
      title: a.title,
      imageUrl: a.cover_image_url,
      city: a.city?.name || null,
    }));
}

module.exports = { listPuzzleImages };
