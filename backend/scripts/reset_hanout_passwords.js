#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, Organization } = require('../models');

// Mot de passe uniforme pour tous les comptes hanout de test
const TEST_PASSWORD = 'Hanout@2024';

async function main() {
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);

  // 1. Reset les comptes existants
  const [updated] = await sequelize.query(`
    UPDATE users u
    JOIN organizations o ON u.organization_id = o.id
    JOIN businesses b ON b.organization_id = o.id
    SET u.hash_mdp = :hash
    WHERE b.business_type = 'hanout'
  `, { replacements: { hash } });
  console.log(`✅ ${updated} compte(s) existant(s) mis à jour`);

  // 2. Créer un user pour hanout-brahim s'il n'en a pas
  const org = await Organization.findOne({ where: { slug: 'hanout-brahim' } });
  if (org) {
    const [[existing]] = await sequelize.query(
      'SELECT id FROM users WHERE organization_id = :oid LIMIT 1',
      { replacements: { oid: org.id } }
    );
    if (!existing) {
      await sequelize.query(`
        INSERT INTO users (matricule, nom, email, hash_mdp, role, actif, organization_id, createdAt, updatedAt)
        VALUES ('hanout.brahim', 'Brahim Proprietaire', 'brahim@hanout.ma', :hash, 'restaurant_owner', 1, :oid, NOW(), NOW())
      `, { replacements: { hash, oid: org.id } });
      console.log('✅ User créé pour hanout-brahim : brahim@hanout.ma');
    } else {
      await sequelize.query(
        'UPDATE users SET hash_mdp = :hash WHERE organization_id = :oid',
        { replacements: { hash, oid: org.id } }
      );
      console.log('✅ User hanout-brahim mis à jour');
    }
  }

  // 3. Afficher le récap final
  const [rows] = await sequelize.query(`
    SELECT u.matricule, u.email, u.role, o.name AS org_name, o.slug
    FROM users u
    JOIN organizations o ON u.organization_id = o.id
    JOIN businesses b ON b.organization_id = o.id
    WHERE b.business_type = 'hanout'
    ORDER BY o.id
  `);

  console.log('\n─────────────────────────────────────────────────────');
  console.log('  COMPTES HANOUT — MOT DE PASSE : ' + TEST_PASSWORD);
  console.log('─────────────────────────────────────────────────────');
  rows.forEach(r => {
    console.log(`  Org    : ${r.org_name}  (${r.slug})`);
    console.log(`  Email  : ${r.email}`);
    console.log(`  Rôle   : ${r.role}`);
    console.log(`  Page   : /h/${r.slug}`);
    console.log('');
  });
  console.log(`  Mdp    : ${TEST_PASSWORD}`);
  console.log('─────────────────────────────────────────────────────\n');

  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
