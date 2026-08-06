'use strict';

/**
 * Moteur "jeux similaires" — le cœur de la conversion SEO→Play. Calcule un
 * score de ressemblance entre une fiche éditoriale (GamingGame, ex. Dofus)
 * et chaque jeu réellement jouable du catalogue (PlayGame), sur la base de
 * genre/tags/universe/mechanics/view_mode/difficulty (colonnes additives
 * ajoutées à play_games par migrate_gaming_hub.js).
 *
 * Scoring pur (aucune écriture DB pendant le calcul) : genre (poids 3),
 * tags communs (poids 2/tag, cap 3 tags), universe identique (poids 2),
 * mechanics communes (poids 1/mécanique, cap 3), view_mode identique
 * (poids 1), difficulty identique (poids 0.5). Normalisé sur le score
 * maximum théorique (12.5) → valeur 0-1.
 *
 * `suggestSimilarGames` écrit les résultats en base avec source='auto' et
 * approved=false — jamais affiché publiquement tant qu'un admin ne valide
 * pas (voir gamingSimilarHtml5Game.js), même principe que le matching
 * automatique de discover/rubriques.js : on ne fabrique jamais de contenu
 * affiché sans validation humaine.
 */
const { GamingGame, GamingSimilarHtml5Game, PlayGame } = require('../../../models');

const MAX_SCORE = 12.5;
const TAG_WEIGHT = 2;
const TAG_CAP = 3;
const MECHANIC_WEIGHT = 1;
const MECHANIC_CAP = 3;

function toArray(value) {
  return Array.isArray(value) ? value.map(v => String(v).toLowerCase().trim()).filter(Boolean) : [];
}

function overlapCount(a, b) {
  const setB = new Set(b);
  return a.filter(v => setB.has(v)).length;
}

function scoreMatch(gamingGame, playGame) {
  let score = 0;
  const reasons = [];

  const gGenre = (gamingGame.genre || '').toLowerCase().trim();
  const pGenre = (playGame.genre || '').toLowerCase().trim();
  if (gGenre && pGenre && gGenre === pGenre) { score += 3; reasons.push('genre'); }

  const tagOverlap = overlapCount(toArray(gamingGame.tags), toArray(playGame.tags));
  if (tagOverlap > 0) { score += Math.min(tagOverlap, TAG_CAP) * TAG_WEIGHT; reasons.push('tags'); }

  const gUniverse = (gamingGame.universe || '').toLowerCase().trim();
  const pUniverse = (playGame.universe || '').toLowerCase().trim();
  if (gUniverse && pUniverse && gUniverse === pUniverse) { score += 2; reasons.push('universe'); }

  const mechanicOverlap = overlapCount(toArray(gamingGame.mechanics), toArray(playGame.mechanics));
  if (mechanicOverlap > 0) { score += Math.min(mechanicOverlap, MECHANIC_CAP) * MECHANIC_WEIGHT; reasons.push('mechanics'); }

  if (gamingGame.view_mode && playGame.view_mode && gamingGame.view_mode === playGame.view_mode) {
    score += 1; reasons.push('view_mode');
  }

  if (gamingGame.difficulty && playGame.difficulty && gamingGame.difficulty === playGame.difficulty) {
    score += 0.5; reasons.push('difficulty');
  }

  return { score: Math.min(1, score / MAX_SCORE), reasons };
}

async function computeCandidates(gamingGameId, { minScore = 0.15 } = {}) {
  const gamingGame = await GamingGame.findByPk(gamingGameId);
  if (!gamingGame) { const e = new Error('Fiche jeu introuvable'); e.status = 404; throw e; }

  const playGames = await PlayGame.findAll({ where: { active: true }, raw: true });
  const candidates = playGames
    .map(playGame => {
      const { score, reasons } = scoreMatch(gamingGame, playGame);
      return { playGame, score, reasons };
    })
    .filter(c => c.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return { gamingGame, candidates };
}

// Calcule et persiste le top 30 (source='auto', approved=false) — un admin
// valide/réordonne ensuite via l'admin (PATCH /similar/:id/approve).
async function suggestSimilarGames(gamingGameId, { limit = 30, minScore = 0.15 } = {}) {
  const { candidates } = await computeCandidates(gamingGameId, { minScore });
  const top = candidates.slice(0, limit);

  const rows = [];
  for (let i = 0; i < top.length; i++) {
    const { playGame, score, reasons } = top[i];
    const [row] = await GamingSimilarHtml5Game.findOrCreate({
      where: { gaming_game_id: gamingGameId, play_game_id: playGame.id },
      defaults: {
        match_score: score,
        match_reasons: reasons,
        source: 'auto',
        approved: false,
        sort_order: i,
      },
    });
    // Ne recalcule que si la ligne vient bien du moteur auto — ne jamais
    // écraser une validation/curation manuelle existante.
    if (row.source === 'auto') {
      row.match_score = score;
      row.match_reasons = reasons;
      row.sort_order = i;
      await row.save();
    }
    rows.push(row);
  }
  return rows;
}

// Lecture publique — uniquement les liens approuvés, triés sort_order.
async function listApprovedSimilarGames(gamingGameId, { limit = 15 } = {}) {
  const links = await GamingSimilarHtml5Game.findAll({
    where: { gaming_game_id: gamingGameId, approved: true },
    include: [{ model: PlayGame, as: 'playGame' }],
    order: [['sort_order', 'ASC']],
    limit,
  });
  return links
    .filter(link => link.playGame && link.playGame.active)
    .map(link => ({
      slug: link.playGame.slug,
      name: link.playGame.name,
      genre: link.playGame.genre || link.playGame.category || null,
      thumbnail_url: link.playGame.thumbnail_url,
      match_score: Number(link.match_score),
      match_reasons: link.match_reasons || [],
    }));
}

module.exports = { scoreMatch, computeCandidates, suggestSimilarGames, listApprovedSimilarGames };
