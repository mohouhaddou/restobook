'use strict';

/**
 * Tests migration IA Discover -> OpenAI.
 * Usage: node tests/discover_ai_openai.test.js
 */

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  OK  ${message}`); pass++; }
  else { console.error(`  FAIL ${message}`); fail++; }
}

async function run() {
  console.log('\nTests — Discover AI OpenAI migration\n');

  const pkg = require('../package.json');
  assert(!!pkg.dependencies.openai, 'openai SDK officiel present dans backend/package.json');
  assert(!!pkg.dependencies.zod, 'zod present pour validation structuree');
  assert(!pkg.dependencies['@anthropic-ai/sdk'], 'SDK Anthropic supprime des dependances directes');

  const service = require('../src/web/discover/aiDraftService');
  const models = require('../models');
  const publicDataService = require('../src/shared/seo/publicDataService');

  const oldKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await service.generateDraft({ topic: 'Guide pizza Rabat', category: 'guide' });
    assert(false, 'absence OPENAI_API_KEY doit echouer');
  } catch (e) {
    assert(e.code === 'AI_NOT_CONFIGURED', 'absence OPENAI_API_KEY -> AI_NOT_CONFIGURED');
  } finally {
    if (oldKey !== undefined) process.env.OPENAI_API_KEY = oldKey;
    else process.env.OPENAI_API_KEY = 'test-key';
  }

  const invalid = service.DraftResultSchema.safeParse({ title: 'trop court' });
  assert(!invalid.success, 'schema Zod rejette une sortie incomplete');

  const originalArticleFindOne = models.Article.findOne;
  const originalArticleCreate = models.Article.create;
  const originalListRestaurants = publicDataService.listRestaurants;
  const originalGetRestaurantBySlug = publicDataService.getRestaurantBySlug;
  const originalListBusinesses = publicDataService.listBusinesses;

  models.Article.findOne = async () => null;
  models.Article.create = async (payload) => ({
    ...payload,
    id: 123,
    getDataValue(key) { return this[key]; },
    setDataValue(key, value) { this[key] = value; },
  });
  publicDataService.listRestaurants = async () => ({ restaurants: [{ slug: 'pizza-rabat' }] });
  publicDataService.getRestaurantBySlug = async () => ({
    id: 1,
    slug: 'pizza-rabat',
    name: 'Pizza Rabat',
    city: 'Rabat',
    description: 'Restaurant de pizzas a Rabat',
    avg_rating: 4.5,
    cover_url: '/uploads/pizza.webp',
    menu_items: [{ module: 'resto', slug: 'margherita', name: 'Pizza Margherita', price: 55 }],
  });
  publicDataService.listBusinesses = async () => ({ businesses: [] });

  const fakeProvider = {
    async generateStructuredData() {
      return {
        title: 'Guide des pizzas a Rabat avec iFilino',
        slug: 'guide-pizzas-rabat',
        excerpt: 'Un guide pratique pour choisir une pizza a Rabat sans inventer de donnees commerciales.',
        seo_title: 'Guide pizzas Rabat | iFilino',
        seo_description: 'Conseils pour commander une pizza a Rabat avec des donnees issues de la marketplace iFilino.',
        tags: ['pizza', 'rabat'],
        body: '## Choisir une pizza a Rabat\n' + 'Contenu utile et factuel. '.repeat(30),
        faq: [
          { question: 'Comment choisir une pizza a Rabat ?', answer: 'Comparez les informations disponibles dans iFilino et verifiez le brouillon avant publication.' },
          { question: 'Les prix sont-ils inventes ?', answer: 'Non, seuls les prix fournis dans les candidats peuvent etre cites.' },
        ],
        related_business_refs: [{ vertical: 'restaurant', slug: 'pizza-rabat' }, { vertical: 'restaurant', slug: 'fake' }],
        related_product_refs: [{ module: 'resto', slug: 'margherita' }, { module: 'resto', slug: 'fake' }],
        recipe_meta: null,
        image_prompt: 'Photo editoriale realiste de pizza a Rabat.',
        image_alt_text: 'Pizza servie a Rabat',
        cta: 'Explorer iFilino',
        internal_link_suggestions: [{ label: 'Marketplace', path: '/marketplace', reason: 'Commander' }],
        needsFactChecking: true,
        factCheckingNotes: ['Relire avant publication.'],
        warnings: [],
      };
    },
  };

  try {
    const article = await service.generateDraft({ topic: 'Guide pizza Rabat', category: 'guide', vertical: 'restaurant', aiProvider: fakeProvider });
    assert(article.status === 'draft', 'generation cree un brouillon');
    assert(article.generated_by_ai === true, 'article marque generated_by_ai');
    assert(article.related_business_refs.length === 1, 'refs commerce hallucinees filtrees');
    assert(article.related_product_refs.length === 1, 'refs produit hallucinees filtrees');
    assert(article.ai_metadata.needsFactChecking === true, 'metadata fact-checking conservee');
  } finally {
    models.Article.findOne = originalArticleFindOne;
    models.Article.create = originalArticleCreate;
    publicDataService.listRestaurants = originalListRestaurants;
    publicDataService.getRestaurantBySlug = originalGetRestaurantBySlug;
    publicDataService.listBusinesses = originalListBusinesses;
  }

  const frontendFiles = fs.readdirSync(path.join(__dirname, '../..', 'frontend/src'), { recursive: true })
    .filter(f => /\.(js|jsx|ts|tsx)$/.test(f));
  const leaks = frontendFiles.filter(f => fs.readFileSync(path.join(__dirname, '../..', 'frontend/src', f), 'utf8').includes('OPENAI_API_KEY'));
  assert(leaks.length === 0, 'OPENAI_API_KEY absente du code frontend');

  console.log(`\nResultats : ${pass} OK | ${fail} FAIL\n`);
  if (fail) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
