import fs from 'node:fs';
import path from 'node:path';

const localesDir = path.resolve('src/i18n/locales');
const languages = ['fr', 'ar', 'en'];

function load(lang) {
  const dir = path.join(localesDir, lang);
  const bundle = {};
  for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    Object.assign(bundle, JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
  }
  return bundle;
}

const bundles = Object.fromEntries(languages.map(lang => [lang, load(lang)]));
const frKeys = Object.keys(bundles.fr).sort();
let failed = false;

console.log(`i18n coverage: fr=${frKeys.length} keys`);
for (const lang of ['ar', 'en']) {
  const missing = frKeys.filter(key => !(key in bundles[lang]));
  const extra = Object.keys(bundles[lang]).filter(key => !(key in bundles.fr)).sort();
  const coverage = frKeys.length ? Math.round(((frKeys.length - missing.length) / frKeys.length) * 1000) / 10 : 100;
  console.log(`${lang}: ${coverage}% coverage, missing=${missing.length}, extra=${extra.length}`);
  if (missing.length) {
    failed = true;
    for (const key of missing) console.log(`  missing ${lang}: ${key}`);
  }
}

process.exit(failed ? 1 : 0);
