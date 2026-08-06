'use strict';

const DEFAULT_PREVIEW_LENGTH = 1200;
const DEFAULT_PREMIUM_BADGE = 'Premium';

function normalizeFreemiumFields(content) {
  const raw = content?.toJSON ? content.toJSON() : (content || {});
  const isPremium = Boolean(raw.isPremium ?? raw.is_premium ?? false);
  const parsedLength = Number(raw.previewLength ?? raw.preview_length ?? DEFAULT_PREVIEW_LENGTH);
  return {
    isPremium,
    previewLength: Number.isFinite(parsedLength) ? Math.max(0, Math.floor(parsedLength)) : DEFAULT_PREVIEW_LENGTH,
    premiumBadge: String(raw.premiumBadge ?? raw.premium_badge ?? DEFAULT_PREMIUM_BADGE).trim() || DEFAULT_PREMIUM_BADGE,
  };
}

function authorizePublication(content, { isAuthenticated = false } = {}) {
  const fields = normalizeFreemiumFields(content);
  const hasFullAccess = !fields.isPremium || Boolean(isAuthenticated);
  return { ...fields, hasFullAccess, isPreview: fields.isPremium && !hasFullAccess };
}

function applyPublicationAccess(body, authorization) {
  if (!authorization?.isPreview || typeof body !== 'string') return body;
  const limit = authorization.previewLength;
  if (limit <= 0) return '';
  if (body.length <= limit) return body;
  return `${body.slice(0, limit).trimEnd()}\n\n…`;
}

module.exports = { DEFAULT_PREVIEW_LENGTH, DEFAULT_PREMIUM_BADGE, normalizeFreemiumFields, authorizePublication, applyPublicationAccess };
