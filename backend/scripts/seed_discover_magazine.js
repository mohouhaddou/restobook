#!/usr/bin/env node
'use strict';

/**
 * Seed de démonstration — iFilino Discover (Discover).
 * Génère les 10 articles de démonstration du brief via le moteur IA
 * (aiDraftService, mode longForm) en s'appuyant sur les vraies données
 * marketplace. Script one-off, à relancer manuellement — pas une route HTTP.
 *
 * Tous les articles sont créés en status='draft' : aucune auto-publication,
 * l'admin doit relire et publier depuis le CMS (/discover-admin/articles),
 * même workflow que toute génération IA individuelle.
 *
 * Usage : node scripts/seed_discover_magazine.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Article, City } = require('../models');
const { slugify } = require('../src/shared/utils/slug');
const aiDraftService = require('../src/web/discover/aiDraftService');

const TOPICS = [
  { topic: 'Les meilleures pizzas à Rabat', category: 'guide', rubrique: 'restaurants_food', vertical: 'restaurant', city: 'Rabat' },
  { topic: 'Les meilleurs burgers à Casablanca', category: 'guide', rubrique: 'restaurants_food', vertical: 'restaurant', city: 'Casablanca' },
  { topic: 'Où acheter une viande de qualité à Rabat', category: 'guide', rubrique: 'boucheries', vertical: 'hanout', city: 'Rabat' },
  { topic: 'Les meilleures boulangeries artisanales de Casablanca', category: 'guide', rubrique: 'boulangeries', vertical: 'restaurant', city: 'Casablanca' },
  { topic: 'Les cafés incontournables de Marrakech', category: 'guide', rubrique: 'cafes', vertical: 'restaurant', city: 'Marrakech' },
  { topic: 'Les meilleures pâtisseries marocaines à découvrir', category: 'guide', rubrique: 'patisseries', vertical: 'hanout', city: null },
  { topic: 'Comment économiser sur ses courses avec iFilino', category: 'conseil', rubrique: 'courses_epiceries', vertical: 'hanout', city: null },
  { topic: 'Les fruits et légumes de saison au Maroc', category: 'conseil', rubrique: 'conseils_astuces', vertical: 'hanout', city: null },
  { topic: 'Guide complet des pharmacies de garde', category: 'guide', rubrique: 'sante_pharmacies', vertical: 'pharmacie', city: null },
  { topic: 'Les spécialités culinaires à tester absolument au Maroc', category: 'vie_locale', rubrique: 'maroc', vertical: 'restaurant', city: null },
];

async function resolveCityId(name) {
  if (!name) return null;
  const city = await City.findOne({ where: { slug: slugify(name) } });
  return city ? city.id : null;
}

// Un article de test pour le même sujet a été créé pendant le développement
// du moteur IA (slug "les-meilleurs-pizzas-a-rabat") — on le remplace par la
// version longForm plutôt que de créer un doublon.
async function removeExistingDraftForTopic(topic) {
  const rootSlug = slugify(topic);
  const existing = await Article.findOne({ where: { slug: rootSlug } });
  if (existing) {
    console.log(`  · article existant "${existing.slug}" (id=${existing.id}) supprimé avant régénération`);
    await existing.destroy();
  }
}

async function run() {
  console.log(`Seed iFilino Discover — ${TOPICS.length} articles\n`);

  for (const [i, t] of TOPICS.entries()) {
    console.log(`[${i + 1}/${TOPICS.length}] ${t.topic}`);
    try {
      await removeExistingDraftForTopic(t.topic);
      const cityId = await resolveCityId(t.city);
      if (t.city && !cityId) console.log(`  ⚠ ville "${t.city}" introuvable en base — génération sans filtre ville`);

      const article = await aiDraftService.generateDraft({
        topic: t.topic,
        category: t.category,
        rubrique: t.rubrique,
        vertical: t.vertical,
        cityId,
        authorId: null,
        longForm: true,
      });
      console.log(`  ✓ créé : ${article.slug} (id=${article.id}, status=${article.status})`);
    } catch (e) {
      console.error(`  ❌ échec pour "${t.topic}" :`, e.message);
    }
  }

  console.log('\n✅ Seed terminé — relire et publier depuis /discover-admin/articles');
  process.exit(0);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
