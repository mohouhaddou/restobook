'use strict';

/**
 * Extension point volontairement synchrone et déterministe pour l'instant.
 * Les futurs détecteurs IA / anti-spam / insultes pourront enrichir ce contrat
 * sans modifier les routes publiques.
 */
async function evaluateReviewDraft({ business, user, payload }) {
  const comment = String(payload.comment || '').trim();
  const signals = [];

  if (comment.length < 3) signals.push('empty_comment');
  if (/(.)\1{8,}/i.test(comment)) signals.push('repeated_characters');

  return {
    status: signals.length > 0 ? 'pending' : 'published',
    trust_score: user?.email_verified ? 75 : 55,
    verified: Boolean(user?.email_verified),
    moderation: {
      signals,
      business_id: business?.id || null,
      reviewed_by: 'rules:v1',
    },
  };
}

module.exports = { evaluateReviewDraft };
