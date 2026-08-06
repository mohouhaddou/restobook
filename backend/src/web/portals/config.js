'use strict';

const PORTALS = {
  sports: {
    contentTypes: ['news', 'articles', 'competitions', 'clubs', 'players', 'matches', 'live', 'videos', 'standings', 'statistics', 'community'],
  },
  kids: {
    contentTypes: ['learn', 'games', 'stories', 'quizzes', 'drawing', 'music', 'videos', 'animals', 'science', 'space', 'nature', 'history', 'crafts'],
  },
};

function getPortal(name) {
  return PORTALS[String(name || '').toLowerCase()] || null;
}

module.exports = { PORTALS, getPortal };
