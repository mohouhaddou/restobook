#!/usr/bin/env node
'use strict';
/**
 * Migration Pharmacie — étend les ENUM existants (organizations.type,
 * businesses.business_type, businesses.module, users.role) puis crée
 * les tables du module pharmacie. Idempotente.
 *
 * Usage : node backend/scripts/migrate_pharmacy.js [--alter]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');
const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), dialect: 'mysql', logging: false }
);

const alter = process.argv.includes('--alter');

async function extendEnumIfMissing(table, column, newEnumSql, defaultValue, mustInclude) {
  const [rows] = await seq.query(`
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
  `);
  if (rows.length && !rows[0].COLUMN_TYPE.includes(mustInclude)) {
    await seq.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ENUM(${newEnumSql}) NOT NULL DEFAULT '${defaultValue}'`);
    console.log(`  ✓ ENUM ${table}.${column} étendu`);
  } else {
    console.log(`  · ENUM ${table}.${column} déjà étendu`);
  }
}

async function main() {
  try {
    await seq.authenticate();
    console.log('✅ DB connectée\n');

    console.log('── 1. ENUM existants ────────────────────────────────────────');
    await extendEnumIfMissing(
      'organizations', 'type',
      `'canteen','restaurant','snack','dark_kitchen','bakery','cafe','pharmacie'`,
      'canteen', 'pharmacie'
    );
    await extendEnumIfMissing(
      'businesses', 'business_type',
      `'restaurant','cafe','cantine','hanout','boulangerie','patisserie','boucherie','pharmacie','autre'`,
      'restaurant', 'pharmacie'
    );
    await extendEnumIfMissing(
      'businesses', 'module',
      `'resto','cantine','hanout','pharmacie','marketplace'`,
      'resto', 'pharmacie'
    );
    await extendEnumIfMissing(
      'users', 'role',
      `'superadmin','restaurant_owner','restaurant_manager','canteen_admin','organization_admin','employee','customer','kitchen_staff','delivery','pharmacy_owner','pharmacist','pharmacy_cashier','pharmacy_stock_manager','pharmacy_delivery_manager','owner','admin','manager','staff','user'`,
      'user', 'pharmacy_owner'
    );

    console.log('\n── 2. Tables module Pharmacie ───────────────────────────────');
    const {
      PharmacyProfile, PharmacyMedicine, PharmacyMedicineLot, PharmacySupplier,
      PharmacyPurchaseOrder, PharmacyPurchaseOrderItem, PharmacyCustomer,
      PharmacyPrescription, PharmacyPrescriptionItem, PharmacySale, PharmacySaleItem,
      PharmacyCredit, PharmacyCreditPayment, PharmacyCreditAuditLog, PharmacyRequest,
    } = require('../models');

    // Ordre : tables référencées avant tables référençantes (FK)
    const ordered = [
      ['pharmacy_profiles', PharmacyProfile],
      ['pharmacy_suppliers', PharmacySupplier],
      ['pharmacy_medicines', PharmacyMedicine],
      ['pharmacy_medicine_lots', PharmacyMedicineLot],
      ['pharmacy_purchase_orders', PharmacyPurchaseOrder],
      ['pharmacy_purchase_order_items', PharmacyPurchaseOrderItem],
      ['pharmacy_customers', PharmacyCustomer],
      ['pharmacy_prescriptions', PharmacyPrescription],
      ['pharmacy_prescription_items', PharmacyPrescriptionItem],
      ['pharmacy_sales', PharmacySale],
      ['pharmacy_sale_items', PharmacySaleItem],
      ['pharmacy_credits', PharmacyCredit],
      ['pharmacy_credit_payments', PharmacyCreditPayment],
      ['pharmacy_credit_audit_logs', PharmacyCreditAuditLog],
      ['pharmacy_requests', PharmacyRequest],
    ];
    for (const [name, Model] of ordered) {
      await Model.sync({ alter });
      console.log(`  ✓ ${name} OK`);
    }

    console.log('\n🎉 Migration Pharmacie terminée\n');
    process.exit(0);
  } catch (e) {
    console.error('❌ Erreur migration :', e.message);
    process.exit(1);
  }
}

main();
