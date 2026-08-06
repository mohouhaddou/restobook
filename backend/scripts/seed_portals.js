#!/usr/bin/env node
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sequelize, PortalContent } = require('../models');

const samples = {
  sports: [
    ['news', 'botola-reprise', 'La Botola reprend avec une affiche très attendue', 'Botola returns with a highly anticipated fixture', 'عودة البطولة بمواجهة منتظرة'],
    ['matches', 'match-du-jour', 'Le match du jour', 'Match of the day', 'مباراة اليوم'],
    ['competitions', 'champions-league', 'Champions League', 'Champions League', 'دوري أبطال أوروبا'],
    ['clubs', 'wydad-ac', 'Wydad Athletic Club', 'Wydad Athletic Club', 'نادي الوداد الرياضي'],
    ['players', 'achraf-hakimi', 'Achraf Hakimi', 'Achraf Hakimi', 'أشرف حكيمي'],
    ['videos', 'resume-semaine', 'Les buts de la semaine', 'Goals of the week', 'أهداف الأسبوع'],
  ],
  kids: [
    ['learn', 'systeme-solaire', 'Découvre le système solaire', 'Discover the solar system', 'اكتشف النظام الشمسي'],
    ['stories', 'petit-renard', 'Le petit renard courageux', 'The brave little fox', 'الثعلب الصغير الشجاع'],
    ['quizzes', 'animaux-monde', 'Quiz : les animaux du monde', 'Quiz: animals of the world', 'اختبار حيوانات العالم'],
    ['science', 'arc-en-ciel', 'Comment naît un arc-en-ciel ?', 'How is a rainbow made?', 'كيف يتكون قوس قزح؟'],
    ['crafts', 'fusee-carton', 'Construis une fusée en carton', 'Build a cardboard rocket', 'اصنع صاروخا من الورق المقوى'],
    ['games', 'memoire-couleurs', 'Le jeu des couleurs', 'The color game', 'لعبة الألوان'],
  ],
};

async function run() {
  await sequelize.authenticate();
  for (const [portal, rows] of Object.entries(samples)) {
    for (let index = 0; index < rows.length; index += 1) {
      const [content_type, slug, title_fr, title_en, title_ar] = rows[index];
      const excerpt = portal === 'sports'
        ? 'Retrouvez les informations, résultats et statistiques essentielles.'
        : 'Un contenu amusant, éducatif et adapté à toute la famille.';
      await PortalContent.findOrCreate({
        where: { portal, slug },
        defaults: {
          portal, content_type, slug, title_fr, title_en, title_ar,
          excerpt_fr: excerpt, excerpt_en: excerpt, excerpt_ar: excerpt,
          body_fr: excerpt, body_en: excerpt, body_ar: excerpt,
          status: 'published', featured: index < 2, sort_order: index,
          published_at: new Date(), metadata: {},
        },
      });
    }
  }
  console.log('✓ Contenus Sports et Kids initialisés');
  await sequelize.close();
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
