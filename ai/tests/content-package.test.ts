const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Ajv2020 = require('ajv/dist/2020').default;

const aiRoot = path.resolve(__dirname, '..');
const readJson = relativePath =>
  JSON.parse(fs.readFileSync(path.join(aiRoot, relativePath), 'utf8'));

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: false,
});

for (const schemaName of [
  'metadata.schema.json',
  'seo.schema.json',
  'images.schema.json',
]) {
  ajv.addSchema(readJson(`schema/${schemaName}`));
}

const contentSchema = readJson('schema/content-package.schema.json');
const validateContentPackage = ajv.compile(contentSchema);
const exampleFiles = [
  'discover-package.json',
  'sports-package.json',
  'kids-package.json',
  'stories-package.json',
  'gaming-package.json',
];

test('les exemples respectent le schéma ContentPackage', () => {
  for (const filename of exampleFiles) {
    const example = readJson(`examples/${filename}`);
    assert.equal(
      validateContentPackage(example),
      true,
      `${filename}: ${ajv.errorsText(validateContentPackage.errors)}`,
    );
  }
});

test('chaque propriété racine obligatoire est effectivement requise', () => {
  const reference = readJson('examples/discover-package.json');

  for (const property of contentSchema.required) {
    const candidate = structuredClone(reference);
    delete candidate[property];

    assert.equal(validateContentPackage(candidate), false, property);
    assert.ok(
      validateContentPackage.errors.some(
        error => error.keyword === 'required' && error.params.missingProperty === property,
      ),
      `Erreur required absente pour ${property}`,
    );
  }
});

test('les incohérences de types sont rejetées', () => {
  const cases = [
    candidate => { candidate.metadata.readingTime = 'quatre'; },
    candidate => { candidate.images[0].width = '1600'; },
    candidate => { candidate.workflow.steps[0].order = 1.5; },
    candidate => { candidate.status = 42; },
  ];

  for (const mutate of cases) {
    const candidate = structuredClone(readJson('examples/discover-package.json'));
    mutate(candidate);
    assert.equal(validateContentPackage(candidate), false);
  }
});
