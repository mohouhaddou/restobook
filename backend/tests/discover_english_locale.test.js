'use strict';

const assert = require('assert');
const { SUPPORTED_LANGUAGES, normalizeLanguage, isRtlLanguage, ogLocaleForLanguage } = require('../src/modules/discover/i18n');
const { rubriqueLabel } = require('../src/modules/discover/rubriques');
const meta = require('../src/modules/seo/metaGenerator');

assert.deepStrictEqual(SUPPORTED_LANGUAGES, ['ar', 'fr', 'en']);
assert.strictEqual(normalizeLanguage('en-US'), 'en');
assert.strictEqual(normalizeLanguage('de'), 'ar');
assert.strictEqual(isRtlLanguage('en'), false);
assert.strictEqual(isRtlLanguage('ar'), true);
assert.strictEqual(ogLocaleForLanguage('en'), 'en_US');
assert.strictEqual(rubriqueLabel('courses_epiceries', 'en'), 'Groceries');

const home = meta.buildDiscoverHomeMeta('en');
assert.strictEqual(home.lang, 'en');
assert.strictEqual(home.dir, 'ltr');
assert.strictEqual(home.og.locale, 'en_US');
assert.strictEqual(home.canonical.endsWith('/discover/en'), true);
assert.deepStrictEqual(home.hreflang.map(item => item.lang), ['ar', 'fr', 'en', 'x-default']);

const rubrique = meta.buildDiscoverRubriqueMeta({ key: 'promotions', label: 'Deals' }, 'en');
assert.strictEqual(rubrique.lang, 'en');
assert.strictEqual(rubrique.canonical.endsWith('/discover/en/promotions'), true);
assert(rubrique.description.includes('latest iFilino Discover stories'));

console.log('discover english locale tests ok');
