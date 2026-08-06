'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { authorizePublication, applyPublicationAccess } = require('../src/web/portals/freemium/accessPolicy');
const { serializeContent } = require('../src/web/portals/serializer');

const premium = { id: 1, portal: 'kids', content_type: 'stories', slug: 'story', isPremium: true, previewLength: 12, premiumBadge: 'Club', metadata: {}, featured: false, view_count: 0 };
const translation = { language: 'en', slug: 'story', title: 'Story', excerpt: 'Summary', body: '12345678901234567890' };

test('free publications remain fully accessible to guests', () => {
  assert.equal(authorizePublication({ isPremium: false }).hasFullAccess, true);
});
test('premium publications return only the configured preview to guests', () => {
  const item = serializeContent(premium, translation, { withBody: true, isAuthenticated: false });
  assert.equal(item.access.isPreview, true);
  assert.equal(item.premiumBadge, 'Club');
  assert.ok(item.body.startsWith('123456789012'));
  assert.ok(item.body.length < translation.body.length);
});
test('authenticated readers receive the complete premium publication', () => {
  const item = serializeContent(premium, translation, { withBody: true, isAuthenticated: true });
  assert.equal(item.access.hasFullAccess, true);
  assert.equal(item.body, translation.body);
});
test('list serialization never exposes a publication body', () => {
  const item = serializeContent(premium, translation, { isAuthenticated: true });
  assert.equal(item.body, undefined);
});
test('zero-length previews expose no premium body', () => {
  assert.equal(applyPublicationAccess('secret', { isPreview: true, previewLength: 0 }), '');
});
