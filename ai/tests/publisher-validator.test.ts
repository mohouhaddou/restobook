import assert from 'node:assert/strict';
import test from 'node:test';
import discoverPackageJson from '../examples/discover-package.json';
import { PublisherValidator } from '../publisher';
import type { ContentPackage } from '../types';

const validPackage = discoverPackageJson as ContentPackage;

test('PublisherValidator accepte un ContentPackage complet', () => {
  const validator = new PublisherValidator();
  const result = validator.validate(validPackage);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('PublisherValidator exige au moins une image', () => {
  const validator = new PublisherValidator();
  const result = validator.validate({ ...validPackage, images: [] });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('au moins une image')));
});

test('PublisherValidator exige un contenu Markdown non vide', () => {
  const validator = new PublisherValidator();
  const result = validator.validate({ ...validPackage, articleMarkdown: '   ' });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('articleMarkdown')));
});

test('PublisherValidator contrôle les métadonnées et le SEO', () => {
  const validator = new PublisherValidator();
  const metadataResult = validator.validate({ ...validPackage, metadata: null });
  const seoResult = validator.validate({ ...validPackage, seo: null });

  assert.equal(metadataResult.valid, false);
  assert.ok(metadataResult.errors.some(error => error.includes('metadata')));
  assert.equal(seoResult.valid, false);
  assert.ok(seoResult.errors.some(error => error.includes('seo')));
});
