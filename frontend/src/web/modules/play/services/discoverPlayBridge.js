const RULES = [
  { slug: 'penalty-master', terms: ['sport', 'football', 'foot', 'can', 'mondial', 'stade'] },
  { slug: 'guess-place', terms: ['voyage', 'maroc', 'ville', 'destination', 'tourisme', 'lieu', 'patrimoine'] },
  { slug: 'geo-quiz', terms: ['culture', 'histoire', 'géographie', 'geographie', 'tradition'] },
  { slug: 'puzzle-image', terms: ['photo', 'image', 'art', 'architecture', 'paysage'] },
  { slug: 'memory-cards', terms: ['famille', 'enfant', 'mémoire', 'memoire', 'éducation', 'education'] },
  { slug: 'snake', terms: ['tech', 'digital', 'innovation', 'arcade'] },
];
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function recommendGameForArticle(article, games) {
  if (!article || !games?.length) return null;
  const haystack = normalize([article.title, article.rubrique, ...(article.tags || []).map(tag => tag.name || tag.tag || tag)].join(' '));
  for (const rule of RULES) {
    if (!rule.terms.some(term => haystack.includes(normalize(term)))) continue;
    const match = games.find(game => game.slug === rule.slug || game.game_type?.replaceAll('_', '-') === rule.slug);
    if (match) return match;
  }
  return games.find(game => game.slug === 'memory-cards') || games[0];
}


export function recommendArticleForGame(game, articles) {
  if (!game || !articles?.length) return null;
  const rule = RULES.find(item => item.slug === game.slug || game.game_type?.replaceAll("_", "-") === item.slug);
  if (!rule) return articles[0];
  return articles.find(article => {
    const haystack = normalize([article.title, article.summary, article.rubrique, ...(article.tags || []).map(tag => tag.name || tag.tag || tag)].join(" "));
    return rule.terms.some(term => haystack.includes(normalize(term)));
  }) || articles[0];
}
