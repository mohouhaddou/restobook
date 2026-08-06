#!/usr/bin/env node
'use strict';
/**
 * Migration Crédit Clients (hanout) — crée les tables
 * hanout_credit_customers, hanout_credits, hanout_credit_payments, hanout_credit_audit_logs.
 *
 * Usage : node backend/scripts/migrate_hanout_credit.js [--alter]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const {
  sequelize, HanoutCreditCustomer, HanoutCredit, HanoutCreditPayment, HanoutCreditAuditLog,
} = require('../models');

const force = process.argv.includes('--force');
const alter = process.argv.includes('--alter');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connectée');

    await HanoutCreditCustomer.sync({ force, alter });
    console.log('✅ hanout_credit_customers OK');

    await HanoutCredit.sync({ force, alter });
    console.log('✅ hanout_credits OK');

    await HanoutCreditPayment.sync({ force, alter });
    console.log('✅ hanout_credit_payments OK');

    await HanoutCreditAuditLog.sync({ force, alter });
    console.log('✅ hanout_credit_audit_logs OK');

    console.log('\n🎉 Migration Crédit Clients terminée\n');
    process.exit(0);
  } catch (e) {
    console.error('❌ Erreur migration :', e.message);
    process.exit(1);
  }
}

main();
