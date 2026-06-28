'use strict';

require('dotenv').config();
const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: msg => console.log('[SQL]', msg) }
);

async function run() {
  await seq.authenticate();
  console.log('✓ DB connected');

  // ── 1. Colonne prix dans menu_items ──────────────────────────────────────
  const [prixRows] = await seq.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_items' AND COLUMN_NAME = 'prix'`);
  if (!prixRows.length) {
    await seq.query(`ALTER TABLE menu_items ADD COLUMN prix DECIMAL(8,2) NULL AFTER image_url`);
    console.log('✓ Colonne prix ajoutée à menu_items');
  } else console.log('  (prix déjà présente dans menu_items)');

  // ── 2. Table orders ───────────────────────────────────────────────────────
  await seq.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      organization_id INT UNSIGNED    NOT NULL,
      user_id         INT UNSIGNED    NULL,
      type            ENUM('dine_in','takeaway','click_collect') NOT NULL DEFAULT 'dine_in',
      status          ENUM('pending','confirmed','preparing','ready','delivered','cancelled') NOT NULL DEFAULT 'pending',
      total_amount    DECIMAL(8,2)    NOT NULL DEFAULT 0,
      notes           TEXT            NULL,
      pickup_code     VARCHAR(16)     NULL,
      table_label     VARCHAR(64)     NULL,
      guest_name      VARCHAR(191)    NULL,
      guest_phone     VARCHAR(32)     NULL,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_orders_org_status (organization_id, status),
      KEY idx_orders_org_date   (organization_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('✓ Table orders prête');

  // ── 3. Table order_items ──────────────────────────────────────────────────
  await seq.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
      order_id     INT UNSIGNED  NOT NULL,
      menu_item_id INT UNSIGNED  NOT NULL,
      quantity     INT UNSIGNED  NOT NULL DEFAULT 1,
      unit_price   DECIMAL(8,2)  NOT NULL,
      notes        TEXT          NULL,
      PRIMARY KEY (id),
      KEY idx_oi_order    (order_id),
      KEY idx_oi_menuitem (menu_item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('✓ Table order_items prête');

  // ── 4. Table table_reservations ───────────────────────────────────────────
  await seq.query(`
    CREATE TABLE IF NOT EXISTS table_reservations (
      id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
      organization_id INT UNSIGNED  NOT NULL,
      guest_name      VARCHAR(191)  NOT NULL,
      guest_phone     VARCHAR(32)   NULL,
      guest_email     VARCHAR(191)  NULL,
      date_jour       DATE          NOT NULL,
      time_slot       VARCHAR(8)    NOT NULL,
      guests_count    INT UNSIGNED  NOT NULL DEFAULT 2,
      table_label     VARCHAR(64)   NULL,
      status          ENUM('pending','confirmed','seated','cancelled','no_show') NOT NULL DEFAULT 'pending',
      notes           TEXT          NULL,
      created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_tr_org_date (organization_id, date_jour, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('✓ Table table_reservations prête');

  console.log('\n✅ Migration Restaurant terminée.');
  await seq.close();
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
