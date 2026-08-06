'use strict';

/**
 * Tests — moteur de similarité + garde-fous IA du Gaming Hub.
 * Usage : node tests/gaminghub_engine.test.js
 * N'appelle jamais le vrai provider OpenAI (fakeProvider), pas de coût/
 * flakiness réseau — même convention que discover_ai_openai.test.js.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  OK  ${message}`); pass++; }
  else { console.error(`  FAIL ${message}`); fail++; }
}

async function run() {
  console.log('\nTests — Gaming Hub (moteur de similarité + IA)\n');

  // ── 1. similarityService.scoreMatch — fonction pure ──────────────────────
  const similarityService = require('../src/web/gaminghub/similarityService');

  const dofusLike = { genre: 'MMORPG', tags: ['fantasy', 'tactical', 'strategy'], universe: 'Fantasy médiéval', mechanics: ['turn-based', 'pvp'], view_mode: 'isometric', difficulty: 'medium' };

  const perfectMatch = similarityService.scoreMatch(dofusLike, { genre: 'MMORPG', tags: ['fantasy', 'tactical', 'strategy'], universe: 'Fantasy médiéval', mechanics: ['turn-based', 'pvp'], view_mode: 'isometric', difficulty: 'medium' });
  assert(perfectMatch.score === 1, `match parfait normalise a 1 (obtenu ${perfectMatch.score})`);
  assert(perfectMatch.reasons.includes('genre') && perfectMatch.reasons.includes('universe'), 'raisons de match parfait completes');

  const noMatch = similarityService.scoreMatch(dofusLike, { genre: 'Racing', tags: ['cars', 'speed'], universe: 'Ville moderne', mechanics: ['drifting'], view_mode: 'first-person', difficulty: 'hard' });
  assert(noMatch.score === 0, `aucune correspondance -> score 0 (obtenu ${noMatch.score})`);
  assert(noMatch.reasons.length === 0, 'aucune raison de match si rien ne correspond');

  const partialMatch = similarityService.scoreMatch(dofusLike, { genre: 'MMORPG', tags: ['sci-fi'], universe: null, mechanics: [], view_mode: null, difficulty: 'easy' });
  assert(partialMatch.score > 0 && partialMatch.score < perfectMatch.score, `match partiel entre 0 et 1 (obtenu ${partialMatch.score})`);
  assert(partialMatch.reasons.length === 1 && partialMatch.reasons[0] === 'genre', 'match partiel ne retient que le genre');

  const emptyFields = similarityService.scoreMatch({}, {});
  assert(emptyFields.score === 0, 'jeux sans aucune taxonomie renseignee -> score 0, pas de crash');

  // ── 2. listApprovedSimilarGames — jamais un lien non approuvé ────────────
  const models = require('../models');
  const originalFindAll = models.GamingSimilarHtml5Game.findAll;
  let capturedWhere = null;
  models.GamingSimilarHtml5Game.findAll = async (opts) => {
    capturedWhere = opts.where;
    return [
      { match_score: 0.8, match_reasons: ['genre'], playGame: { slug: 'a', name: 'A', active: true, category: 'x', thumbnail_url: null } },
    ];
  };
  try {
    const result = await similarityService.listApprovedSimilarGames(1, { limit: 15 });
    assert(capturedWhere.approved === true, 'la requete publique ne lit que approved=true');
    assert(result.length === 1 && result[0].slug === 'a', 'serialisation publique correcte');
  } finally {
    models.GamingSimilarHtml5Game.findAll = originalFindAll;
  }

  // ── 3. gameService.listGames — jamais un brouillon visible publiquement ──
  const gameService = require('../src/web/gaminghub/gameService');
  const originalGameFindAndCountAll = models.GamingGame.findAndCountAll;
  let capturedGameWhere = null;
  models.GamingGame.findAndCountAll = async (opts) => { capturedGameWhere = opts.where; return { count: 0, rows: [] }; };
  try {
    await gameService.listGames({});
    assert(capturedGameWhere.status === 'published', 'listGames() sans argument explicite ne renvoie que le contenu publie');
  } finally {
    models.GamingGame.findAndCountAll = originalGameFindAndCountAll;
  }

  // ── 4. aiDraftService — garde-fous légaux structurels ────────────────────
  const aiDraftService = require('../src/web/gaminghub/aiDraftService');

  const gameSchemaKeys = Object.keys(aiDraftService.DRAFT_JSON_SCHEMA.properties);
  assert(!gameSchemaKeys.includes('release_date'), 'release_date jamais demande a l\'IA (fiche jeu)');
  assert(!gameSchemaKeys.includes('configuration'), 'configuration jamais demandee a l\'IA (fiche jeu)');
  assert(!gameSchemaKeys.includes('official_links'), 'official_links jamais demande a l\'IA (fiche jeu)');

  const oldKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await aiDraftService.generateGameDraft({ name: 'Test Game' });
    assert(false, 'absence OPENAI_API_KEY doit echouer');
  } catch (e) {
    assert(e.code === 'AI_NOT_CONFIGURED', `absence OPENAI_API_KEY -> AI_NOT_CONFIGURED (obtenu ${e.code})`);
  } finally {
    if (oldKey !== undefined) process.env.OPENAI_API_KEY = oldKey;
    else process.env.OPENAI_API_KEY = 'test-key';
  }

  try {
    await aiDraftService.generateGameDraft({ name: '' });
    assert(false, 'nom vide doit echouer');
  } catch (e) {
    assert(e.code === 'AI_INVALID_INPUT', `nom de jeu vide -> AI_INVALID_INPUT (obtenu ${e.code})`);
  }

  // Sources : seule une URL effectivement fournie par l'admin doit survivre,
  // même si le modèle en renvoie une autre ou en invente une.
  const fakeGameProvider = {
    generateStructuredData: async () => ({
      seo_title: 'Un titre SEO suffisamment long', seo_description: 'Une description SEO suffisamment longue pour passer la validation Zod ici.',
      tags: ['tag1'], description: 'Une description de jeu suffisamment longue pour passer la validation Zod du brouillon, avec un peu de remplissage supplementaire ici pour depasser le seuil minimum requis.',
      presentation: 'Presentation', why_popular: 'Pourquoi ce jeu est populaire, texte suffisamment long pour la validation Zod configuree avec du remplissage supplementaire.',
      gameplay: 'Description du gameplay, suffisamment longue pour passer la validation Zod configuree, avec du texte de remplissage supplementaire ici.',
      faq: [{ question: 'Question suffisamment longue ?', answer: 'Reponse suffisamment longue pour la validation.' }, { question: 'Deuxieme question ?', answer: 'Deuxieme reponse suffisamment longue.' }],
      sources: [{ label: 'Source inventee par le modele', url: 'https://exemple-invente.test' }],
      needsFactChecking: false, factCheckingNotes: [], warnings: [],
    }),
  };
  const originalGameCreate = models.GamingGame.create;
  models.GamingGame.create = async (payload) => ({ ...payload, id: 999, getDataValue() { return this._meta; }, setDataValue(k, v) { this._meta = v; } });
  try {
    const { game } = await aiDraftService.generateGameDraft({
      name: 'Jeu Test', sources: [{ label: 'Source reelle', url: 'https://vraie-source.test' }], aiProvider: fakeGameProvider,
    });
    assert(game.sources.length === 0, 'une source inventee par le modele (URL non fournie par l\'admin) est filtree');
    assert(game.status === 'draft', 'fiche generee par IA reste en brouillon');
    assert(game.generated_by_ai === true, 'fiche marquee generated_by_ai');
  } finally {
    models.GamingGame.create = originalGameCreate;
  }

  // ── 5. aiDraftService — articles : jamais un jeu hors-catalogue cite ─────
  const originalGameFindAll = models.GamingGame.findAll;
  models.GamingGame.findAll = async () => ([{ id: 1, slug: 'dofus', name: 'Dofus', genre: 'MMORPG', universe: 'Fantasy', why_popular: '' }]);
  const originalArticleCreate = models.GamingArticle.create;
  models.GamingArticle.create = async (payload) => ({ ...payload, id: 888, getDataValue() { return this._meta; }, setDataValue(k, v) { this._meta = v; } });
  const fakeArticleProvider = {
    generateStructuredData: async () => ({
      title: 'Top jeux comme Dofus, un titre suffisamment long', slug: 'top-jeux-comme-dofus', excerpt: 'Un extrait suffisamment long pour la validation Zod configuree ici.',
      seo_title: 'Un titre SEO suffisamment long', seo_description: 'Une description SEO suffisamment longue pour passer la validation Zod ici.',
      tags: ['top'], body: 'Un corps d\'article Markdown suffisamment long pour passer la validation Zod configuree sur au moins quatre cents caracteres, ce qui necessite un peu de remplissage supplementaire ici pour atteindre le seuil minimum requis par le schema de validation du brouillon d\'article. Ce texte de remplissage supplementaire garantit que la longueur totale depasse largement le seuil minimum configure dans le schema Zod du service de generation.',
      faq: [{ question: 'Question suffisamment longue ?', answer: 'Reponse suffisamment longue pour la validation.' }, { question: 'Deuxieme question ?', answer: 'Deuxieme reponse suffisamment longue.' }],
      sources: [],
      related_game_slugs: ['dofus', 'jeu-invente-par-le-modele'],
      needsFactChecking: false, factCheckingNotes: [], warnings: [],
    }),
  };
  try {
    const { article } = await aiDraftService.generateArticleDraft({ topic: 'Top jeux comme Dofus', articleType: 'top', aiProvider: fakeArticleProvider });
    assert(article.related_game_ids.length === 1 && article.related_game_ids[0] === 1, 'seul le jeu reellement candidat (Dofus) est retenu, le jeu invente est filtre');
    assert(article.status === 'draft', 'article genere par IA reste en brouillon');
  } finally {
    models.GamingGame.findAll = originalGameFindAll;
    models.GamingArticle.create = originalArticleCreate;
  }

  console.log(`\nResultats : ${pass} OK | ${fail} FAIL\n`);
  if (fail) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
