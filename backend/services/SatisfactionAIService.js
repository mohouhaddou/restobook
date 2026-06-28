'use strict';

const ISSUE_RULES = [
  { tag: 'price', label: 'Prix', words: ['cher', 'prix', 'coûteux', 'couteux', 'tarif', 'expensive'] },
  { tag: 'quality', label: 'Qualite', words: ['froid', 'sec', 'fade', 'brule', 'brûlé', 'mauvais', 'qualite', 'qualité', 'goût', 'gout'] },
  { tag: 'service', label: 'Service', words: ['service', 'accueil', 'serveur', 'désagréable', 'desagreable', 'erreur', 'oubli'] },
  { tag: 'delay', label: 'Delai', words: ['retard', 'lent', 'attente', 'delai', 'délai', 'long', 'late'] },
  { tag: 'portion', label: 'Portion', words: ['portion', 'petit', 'quantité', 'quantite', 'peu', 'taille'] },
  { tag: 'packaging', label: 'Emballage', words: ['emballage', 'sac', 'renversé', 'renverse', 'coulé', 'coule'] },
];

const POSITIVE_WORDS = ['excellent', 'bon', 'délicieux', 'delicieux', 'parfait', 'rapide', 'frais', 'savoureux', 'merci', 'top'];
const NEGATIVE_WORDS = ['mauvais', 'froid', 'retard', 'cher', 'déçu', 'decu', 'lent', 'fade', 'sec', 'erreur', 'oubli', 'brûlé', 'brule'];

function lower(text) {
  return String(text || '').toLowerCase();
}

function includesAny(text, words) {
  return words.some(word => text.includes(word));
}

function analyzeReview(review) {
  const comment = lower(review.comment);
  const rating = Number(review.rating || 0);
  let score = rating >= 4 ? 65 : rating === 3 ? 45 : 20;

  for (const word of POSITIVE_WORDS) if (comment.includes(word)) score += 7;
  for (const word of NEGATIVE_WORDS) if (comment.includes(word)) score -= 9;
  score = Math.max(0, Math.min(100, score));

  const issueTags = ISSUE_RULES.filter(rule => includesAny(comment, rule.words)).map(rule => rule.tag);
  if (rating <= 2 && issueTags.length === 0) issueTags.push('quality');

  const sentiment = score >= 60 ? 'positive' : score >= 40 ? 'neutral' : 'negative';
  const summary = {
    sentiment,
    sentiment_score: score,
    issue_tags: [...new Set(issueTags)],
    short_summary: comment ? summarizeComment(review.comment, sentiment, issueTags) : `Avis ${sentiment} sans commentaire detaille.`,
    recommendations: recommendationsForIssues(issueTags, rating),
    prompt: buildSatisfactionPrompt([review]),
  };
  return summary;
}

function summarizeComment(comment, sentiment, tags) {
  const prefix = sentiment === 'negative' ? 'Avis negatif' : sentiment === 'positive' ? 'Avis positif' : 'Avis mitige';
  const themes = tags.length ? ` Themes detectes: ${tags.join(', ')}.` : '';
  return `${prefix}: ${String(comment).slice(0, 180)}${themes}`;
}

function recommendationsForIssues(tags, rating) {
  const set = new Set(tags);
  const recs = [];
  if (set.has('price')) recs.push('Verifier la perception prix/portion et tester une formule ou un menu plus lisible.');
  if (set.has('quality')) recs.push('Auditer la recette, la temperature de service et la regularite de preparation.');
  if (set.has('service')) recs.push('Revoir le protocole de prise en charge client et les erreurs de commande.');
  if (set.has('delay')) recs.push('Mesurer les temps de preparation aux heures de pointe et simplifier les plats lents.');
  if (set.has('portion')) recs.push('Comparer les portions servies avec les attentes client et le prix affiche.');
  if (set.has('packaging')) recs.push('Tester les emballages sur les plats sensibles au transport.');
  if (!recs.length && rating <= 3) recs.push('Recontacter les clients insatisfaits et demander une precision sur le probleme.');
  if (!recs.length) recs.push('Capitaliser sur les points forts cites et les mettre en avant dans le menu.');
  return recs;
}

function buildSatisfactionPrompt(reviews) {
  return [
    'Tu es un analyste satisfaction client pour un SaaS restaurant.',
    'Analyse les avis clients et retourne un JSON strict avec:',
    'sentiment global, avis negatifs, plaintes recurrentes, problemes prix, qualite, service, plats apprecies, recommandations concretes.',
    'Reste factuel, actionnable et concis.',
    `Avis: ${JSON.stringify(reviews.map(r => ({ rating: r.rating, comment: r.comment, item_ratings: r.item_ratings || [] })))}`
  ].join('\n');
}

function aggregateSatisfaction({ reviews, itemRows }) {
  const analyzed = reviews.map(review => review.ai_summary || analyzeReview(review));
  const total = reviews.length;
  const avgRating = total ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / total : 0;
  const negativeReviews = reviews.filter((review, idx) => Number(review.rating) <= 2 || analyzed[idx].sentiment === 'negative');

  const issueCounts = {};
  for (const analysis of analyzed) {
    for (const tag of analysis.issue_tags || []) issueCounts[tag] = (issueCounts[tag] || 0) + 1;
  }

  const itemStats = {};
  for (const review of reviews) {
    for (const item of review.item_ratings || []) {
      const key = String(item.menu_item_id || item.libelle || 'unknown');
      if (!itemStats[key]) itemStats[key] = { menu_item_id: item.menu_item_id || null, libelle: item.libelle || 'Plat', ratings: [], comments: [] };
      if (item.rating) itemStats[key].ratings.push(Number(item.rating));
      if (item.comment) itemStats[key].comments.push(item.comment);
    }
  }
  for (const row of itemRows || []) {
    const key = String(row.menu_item_id);
    if (!itemStats[key]) itemStats[key] = { menu_item_id: row.menu_item_id, libelle: row.libelle, ratings: [], comments: [] };
  }

  const items = Object.values(itemStats).map(item => ({
    ...item,
    avg_rating: item.ratings.length ? Math.round((item.ratings.reduce((a, b) => a + b, 0) / item.ratings.length) * 10) / 10 : null,
    reviews_count: item.ratings.length,
  })).sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));

  const issueLabels = Object.fromEntries(ISSUE_RULES.map(rule => [rule.tag, rule.label]));
  const recurrentProblems = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, label: issueLabels[tag] || tag, count }));

  return {
    prompt: buildSatisfactionPrompt(reviews),
    summary: {
      reviews_count: total,
      avg_rating: Math.round(avgRating * 10) / 10,
      negative_count: negativeReviews.length,
      negative_rate: total ? Math.round((negativeReviews.length / total) * 100) : 0,
      sentiment: avgRating >= 4 ? 'positive' : avgRating >= 3 ? 'neutral' : 'negative',
    },
    top_liked_items: items.filter(i => i.avg_rating !== null).slice(0, 5),
    low_rated_items: items.filter(i => i.avg_rating !== null).sort((a, b) => a.avg_rating - b.avg_rating).slice(0, 5),
    recurrent_problems: recurrentProblems,
    negative_reviews: negativeReviews.slice(0, 20).map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.createdAt,
      issue_tags: review.issue_tags || analyzeReview(review).issue_tags,
    })),
    recommendations: recommendationsForIssues(recurrentProblems.map(p => p.tag), avgRating),
  };
}

module.exports = {
  analyzeReview,
  aggregateSatisfaction,
  buildSatisfactionPrompt,
};
