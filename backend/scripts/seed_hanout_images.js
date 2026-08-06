#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { HanoutProduct, Organization } = require('../models');

async function main() {
  const org = await Organization.findOne({ where: { slug: 'hanout-brahim' } });
  if (!org) { console.error('❌ Org hanout-brahim introuvable — lance seed_hanout_test.js d\'abord'); process.exit(1); }

  const map = {
    'Coca-Cola 33cl':              ['/uploads/hanout_cola.jpg'],
    'Eau Minérale 1.5L':           ['/uploads/hanout_eau.jpg'],
    'Lait Centrale 1L':            ['/uploads/hanout_lait.jpg'],
    'Fromage Vache qui Rit 8p':    ['/uploads/hanout_fromage.jpg'],
    "Chips Lay's":                 ['/uploads/hanout_chips.jpg'],
    'Biscuits BN':                 ['/uploads/hanout_biscuits.jpg'],
    'Huile de Table 1L':           ['/uploads/hanout_huile.jpg'],
    'Sucre 1kg':                   ['/uploads/hanout_sucre.jpg'],
  };

  let updated = 0;
  for (const [name, images] of Object.entries(map)) {
    const rows = await HanoutProduct.update(
      { images },
      { where: { organization_id: org.id, name } }
    );
    if (rows[0] > 0) { console.log(`✅ ${name}`); updated++; }
    else              { console.log(`⚠️  ${name} — produit non trouvé`); }
  }

  console.log(`\n🎉 ${updated}/${Object.keys(map).length} produits mis à jour`);
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
