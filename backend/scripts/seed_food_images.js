'use strict';

require('dotenv').config();
const { sequelize, MenuItem } = require('../models');

// Images Unsplash open-source par libellé/type
const IMAGE_MAP = [
  // Plats marocains
  { match: /tajine?.*poulet|poulet.*tajine?/i, url: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=75' },
  { match: /tajine?|tagine/i,                  url: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=600&q=75' },
  { match: /couscous/i,                        url: 'https://images.unsplash.com/photo-1628179487664-a1bb3905a0ef?auto=format&fit=crop&w=600&q=75' },
  { match: /poisson|daurade|saumon|fish|merlan/i, url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=75' },
  { match: /poulet.*r[oô]ti|r[oô]ti.*poulet/i, url: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=600&q=75' },
  { match: /steak|bœuf|hach[eé]/i,             url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=75' },
  { match: /burger/i,                          url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=75' },
  { match: /pizza/i,                           url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=75' },
  { match: /pasta|pâtes|spaghetti/i,           url: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=600&q=75' },
  { match: /wrap|sandwich/i,                   url: 'https://images.unsplash.com/photo-1481070414801-51fd732d7184?auto=format&fit=crop&w=600&q=75' },
  { match: /poisson.*pan[eé]|pan[eé].*poisson/i, url: 'https://images.unsplash.com/photo-1551248429-40975aa4de74?auto=format&fit=crop&w=600&q=75' },

  // Entrées
  { match: /salade.*ma?roc|ma?roc.*salade/i,   url: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=600&q=75' },
  { match: /salade.*c[eé]sar|c[eé]sar/i,      url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=75' },
  { match: /salade/i,                          url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=75' },
  { match: /carottes?.*r[âa]p/i,              url: 'https://images.unsplash.com/photo-1445282768818-728615cc910a?auto=format&fit=crop&w=600&q=75' },
  { match: /soupe|harira|velouté/i,            url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=75' },

  // Desserts
  { match: /tiramisu/i,                        url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=75' },
  { match: /tarte.*pomme|pomme.*tarte/i,       url: 'https://images.unsplash.com/photo-1568571780765-9276b5c4f6e4?auto=format&fit=crop&w=600&q=75' },
  { match: /brownie|chocolat/i,                url: 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?auto=format&fit=crop&w=600&q=75' },
  { match: /compote/i,                         url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=600&q=75' },
  { match: /yaourt|fromage.*blanc/i,           url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=75' },

  // Boissons
  { match: /coca|cola|soda/i,                  url: 'https://images.unsplash.com/photo-1624552184280-9e9631bbeee9?auto=format&fit=crop&w=600&q=75' },
  { match: /jus.*orange|orange.*jus/i,         url: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=600&q=75' },
  { match: /jus/i,                             url: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=75' },
  { match: /eau|water/i,                       url: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=600&q=75' },
  { match: /caf[eé]|coffee/i,                  url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=75' },
];

// Fallbacks par type
const TYPE_FALLBACKS = {
  plat:    'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=75',
  entrée:  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=75',
  dessert: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=75',
  boisson: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&q=75',
};

function findImage(libelle, type) {
  for (const { match, url } of IMAGE_MAP) {
    if (match.test(libelle)) return url;
  }
  return TYPE_FALLBACKS[type] || TYPE_FALLBACKS['plat'];
}

async function run() {
  await sequelize.authenticate();
  console.log('✓ DB connectée');

  const items = await MenuItem.findAll({ where: { image_url: null } });
  console.log(`${items.length} plats sans image…`);

  let updated = 0;
  for (const it of items) {
    const url = findImage(it.libelle, it.type);
    it.image_url = url;
    await it.save();
    console.log(`  ✓ [${it.type}] ${it.libelle}`);
    updated++;
  }

  console.log(`\n✅ ${updated} plat(s) mis à jour avec des images Unsplash.`);
  await sequelize.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
