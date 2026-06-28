'use strict';

/**
 * Migration v3 — RestoBook Next Level Marketplace
 * Idempotente : peut être relancée sans risque.
 * Exécuter : node scripts/migrate_v3.js
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: msg => console.log('[SQL]', msg.slice(0, 120)) }
);

// Helper : ajouter une colonne si elle n'existe pas
async function addColumnIfMissing(table, column, definition, afterColumn) {
  const [rows] = await seq.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
  `);
  if (rows.length === 0) {
    const after = afterColumn ? `AFTER \`${afterColumn}\`` : '';
    await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition} ${after}`);
    console.log(`  ✓ ${table}.${column} ajouté`);
  } else {
    console.log(`  · ${table}.${column} déjà présent`);
  }
}

// Helper : vérifier si un index existe
async function indexExists(table, indexName) {
  const [rows] = await seq.query(`
    SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND INDEX_NAME = '${indexName}'
    LIMIT 1
  `);
  return rows.length > 0;
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ORGANIZATIONS — colonnes marketplace
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('── 1. organizations ──────────────────────────────────────────');

  // Étendre ENUM type
  const [typeRows] = await seq.query(`
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organizations' AND COLUMN_NAME = 'type'
  `);
  if (typeRows.length && !typeRows[0].COLUMN_TYPE.includes('snack')) {
    await seq.query(`
      ALTER TABLE organizations MODIFY COLUMN type
        ENUM('canteen','restaurant','snack','dark_kitchen','bakery','cafe')
        NOT NULL DEFAULT 'canteen'
    `);
    console.log('  ✓ ENUM type organizations étendu');
  } else {
    console.log('  · ENUM type organizations déjà étendu');
  }

  await addColumnIfMissing('organizations', 'address',          "VARCHAR(255) NULL",       'active');
  await addColumnIfMissing('organizations', 'city',             "VARCHAR(100) NULL",       'address');
  await addColumnIfMissing('organizations', 'zone',             "VARCHAR(100) NULL",       'city');
  await addColumnIfMissing('organizations', 'phone',            "VARCHAR(32) NULL",        'zone');
  await addColumnIfMissing('organizations', 'email',            "VARCHAR(191) NULL",       'phone');
  await addColumnIfMissing('organizations', 'description',      "TEXT NULL",               'email');
  await addColumnIfMissing('organizations', 'logo_url',         "VARCHAR(500) NULL",       'description');
  await addColumnIfMissing('organizations', 'cover_url',        "VARCHAR(500) NULL",       'logo_url');
  await addColumnIfMissing('organizations', 'opening_hours',    "JSON NULL",               'cover_url');
  await addColumnIfMissing('organizations', 'cuisine_type',     "VARCHAR(100) NULL",       'opening_hours');
  await addColumnIfMissing('organizations', 'accepts_delivery', "TINYINT(1) DEFAULT 1",    'cuisine_type');
  await addColumnIfMissing('organizations', 'accepts_takeaway', "TINYINT(1) DEFAULT 1",    'accepts_delivery');
  await addColumnIfMissing('organizations', 'accepts_dine_in',  "TINYINT(1) DEFAULT 1",    'accepts_takeaway');
  await addColumnIfMissing('organizations', 'delivery_fee',     "DECIMAL(6,2) DEFAULT 0",  'accepts_dine_in');
  await addColumnIfMissing('organizations', 'min_order_amount', "DECIMAL(8,2) DEFAULT 0",  'delivery_fee');
  await addColumnIfMissing('organizations', 'avg_prep_time',    "INT DEFAULT 20",          'min_order_amount');
  await addColumnIfMissing('organizations', 'avg_rating',       "DECIMAL(3,2) DEFAULT 0",  'avg_prep_time');
  await addColumnIfMissing('organizations', 'total_reviews',    "INT UNSIGNED DEFAULT 0",  'avg_rating');
  await addColumnIfMissing('organizations', 'latitude',         "DECIMAL(10,7) NULL",      'total_reviews');
  await addColumnIfMissing('organizations', 'longitude',        "DECIMAL(10,7) NULL",      'latitude');
  await addColumnIfMissing('organizations', 'is_featured',      "TINYINT(1) DEFAULT 0",    'longitude');

  // Index pour la recherche marketplace
  if (!await indexExists('organizations', 'idx_org_city_active')) {
    await seq.query(`ALTER TABLE organizations ADD INDEX idx_org_city_active (city, active, type)`);
    console.log('  ✓ Index idx_org_city_active ajouté');
  }
  if (!await indexExists('organizations', 'idx_org_featured')) {
    await seq.query(`ALTER TABLE organizations ADD INDEX idx_org_featured (is_featured, active)`);
    console.log('  ✓ Index idx_org_featured ajouté');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. USERS — colonnes marketplace
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 2. users ──────────────────────────────────────────────────');

  const [roleRows] = await seq.query(`
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
  `);
  if (roleRows.length && !roleRows[0].COLUMN_TYPE.includes('customer')) {
    await seq.query(`
      ALTER TABLE users MODIFY COLUMN role
        ENUM('superadmin','owner','admin','manager','staff','user','customer','delivery')
        NOT NULL DEFAULT 'user'
    `);
    console.log('  ✓ ENUM role users étendu (customer, delivery ajoutés)');
  } else {
    console.log('  · ENUM role users déjà étendu');
  }

  await addColumnIfMissing('users', 'phone',      "VARCHAR(32) NULL",  'email');
  await addColumnIfMissing('users', 'avatar_url', "VARCHAR(500) NULL", 'phone');

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ORDERS — colonnes delivery + paiement
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 3. orders ─────────────────────────────────────────────────');

  // Étendre ENUM status
  const [statusRows] = await seq.query(`
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'status'
  `);
  if (statusRows.length && !statusRows[0].COLUMN_TYPE.includes('on_the_way')) {
    await seq.query(`
      ALTER TABLE orders MODIFY COLUMN status
        ENUM('pending','confirmed','preparing','ready','picked_up','on_the_way','delivered','cancelled')
        NOT NULL DEFAULT 'pending'
    `);
    console.log('  ✓ ENUM status orders étendu');
  } else {
    console.log('  · ENUM status orders déjà étendu');
  }

  // Étendre ENUM type pour delivery
  const [typeOrderRows] = await seq.query(`
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'type'
  `);
  if (typeOrderRows.length && !typeOrderRows[0].COLUMN_TYPE.includes('delivery')) {
    await seq.query(`
      ALTER TABLE orders MODIFY COLUMN type
        ENUM('dine_in','takeaway','click_collect','delivery')
        NOT NULL DEFAULT 'dine_in'
    `);
    console.log('  ✓ ENUM type orders étendu (delivery ajouté)');
  } else {
    console.log('  · ENUM type orders déjà étendu');
  }

  await addColumnIfMissing('orders', 'delivery_address',   "TEXT NULL",               'table_label');
  await addColumnIfMissing('orders', 'delivery_fee',       "DECIMAL(6,2) DEFAULT 0",  'delivery_address');
  await addColumnIfMissing('orders', 'service_fee',        "DECIMAL(6,2) DEFAULT 0",  'delivery_fee');
  await addColumnIfMissing('orders', 'discount_amount',    "DECIMAL(6,2) DEFAULT 0",  'service_fee');
  await addColumnIfMissing('orders', 'coupon_code',        "VARCHAR(32) NULL",        'discount_amount');
  await addColumnIfMissing('orders', 'payment_method',
    "ENUM('cash','card','wallet','online') DEFAULT 'cash'",                          'coupon_code');
  await addColumnIfMissing('orders', 'payment_status',
    "ENUM('pending','paid','refunded','failed') DEFAULT 'pending'",                  'payment_method');
  await addColumnIfMissing('orders', 'estimated_ready_at', "DATETIME NULL",           'payment_status');

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. MENU_ITEMS — catégorie + disponibilité
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 4. menu_items ─────────────────────────────────────────────');
  await addColumnIfMissing('menu_items', 'category_id',   "INT UNSIGNED NULL",  'organization_id');
  await addColumnIfMissing('menu_items', 'sort_order',    "INT DEFAULT 0",       'category_id');
  await addColumnIfMissing('menu_items', 'is_available',  "TINYINT(1) DEFAULT 1",'sort_order');

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. TABLE : menu_categories
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 5. menu_categories ────────────────────────────────────────');
  await seq.query(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      organization_id INT UNSIGNED    NOT NULL,
      name            VARCHAR(100)    NOT NULL,
      description     VARCHAR(255)    NULL,
      image_url       VARCHAR(500)    NULL,
      sort_order      INT             NOT NULL DEFAULT 0,
      active          TINYINT(1)      NOT NULL DEFAULT 1,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_cat_org_sort (organization_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('  ✓ Table menu_categories prête');

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. TABLE : addresses
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 6. addresses ──────────────────────────────────────────────');
  await seq.query(`
    CREATE TABLE IF NOT EXISTS addresses (
      id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      user_id     INT UNSIGNED    NOT NULL,
      label       VARCHAR(100)    NOT NULL DEFAULT 'Maison',
      street      VARCHAR(255)    NOT NULL,
      city        VARCHAR(100)    NOT NULL DEFAULT '',
      zone        VARCHAR(100)    NULL,
      notes       VARCHAR(255)    NULL,
      latitude    DECIMAL(10,7)   NULL,
      longitude   DECIMAL(10,7)   NULL,
      is_default  TINYINT(1)      NOT NULL DEFAULT 0,
      created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_addr_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('  ✓ Table addresses prête');

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. TABLE : coupons
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 7. coupons ────────────────────────────────────────────────');
  await seq.query(`
    CREATE TABLE IF NOT EXISTS coupons (
      id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      organization_id INT UNSIGNED    NULL,
      code            VARCHAR(32)     NOT NULL,
      type            ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
      value           DECIMAL(8,2)    NOT NULL,
      min_order       DECIMAL(8,2)    NOT NULL DEFAULT 0,
      max_uses        INT UNSIGNED    NULL,
      used_count      INT UNSIGNED    NOT NULL DEFAULT 0,
      valid_from      DATE            NULL,
      valid_until     DATE            NULL,
      active          TINYINT(1)      NOT NULL DEFAULT 1,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_coupon_code (code),
      KEY idx_coupon_org (organization_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('  ✓ Table coupons prête');

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. TABLE : reviews
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 8. reviews ────────────────────────────────────────────────');
  await seq.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      organization_id INT UNSIGNED    NOT NULL,
      user_id         INT UNSIGNED    NULL,
      order_id        INT UNSIGNED    NULL,
      pickup_code     VARCHAR(16)     NULL,
      rating          TINYINT UNSIGNED NOT NULL,
      comment         TEXT            NULL,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_review_org (organization_id),
      KEY idx_review_user (user_id),
      UNIQUE KEY uq_review_pickup (pickup_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('  ✓ Table reviews prête');

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. TABLE : deliveries
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 9. deliveries ─────────────────────────────────────────────');
  await seq.query(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      order_id        INT UNSIGNED    NOT NULL,
      partner_id      INT UNSIGNED    NULL,
      status          ENUM('pending','assigned','picking_up','picked_up','on_the_way','delivered','failed')
                                      NOT NULL DEFAULT 'pending',
      pickup_at       DATETIME        NULL,
      delivered_at    DATETIME        NULL,
      partner_lat     DECIMAL(10,7)   NULL,
      partner_lng     DECIMAL(10,7)   NULL,
      distance_km     DECIMAL(6,2)    NULL,
      fee             DECIMAL(6,2)    NOT NULL DEFAULT 0,
      notes           TEXT            NULL,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_delivery_order (order_id),
      KEY idx_delivery_partner (partner_id),
      KEY idx_delivery_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('  ✓ Table deliveries prête');

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. TABLES : carts + cart_items
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 10. carts + cart_items ────────────────────────────────────');
  await seq.query(`
    CREATE TABLE IF NOT EXISTS carts (
      id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      user_id         INT UNSIGNED    NULL,
      session_token   VARCHAR(64)     NULL,
      organization_id INT UNSIGNED    NOT NULL,
      expires_at      DATETIME        NOT NULL,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_cart_user (user_id),
      KEY idx_cart_session (session_token),
      KEY idx_cart_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await seq.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      cart_id      INT UNSIGNED    NOT NULL,
      menu_item_id INT UNSIGNED    NOT NULL,
      quantity     INT UNSIGNED    NOT NULL DEFAULT 1,
      notes        VARCHAR(255)    NULL,
      unit_price   DECIMAL(8,2)    NOT NULL,
      created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ci_cart (cart_id),
      KEY idx_ci_item (menu_item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('  ✓ Tables carts + cart_items prêtes');

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. Mettre à jour les organisations existantes (settings → colonnes)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 11. Backfill organisations ────────────────────────────────');

  // Récupérer les settings existants et les copier dans les nouvelles colonnes
  const [orgs] = await seq.query(`SELECT id FROM organizations`);
  for (const org of orgs) {
    const [settings] = await seq.query(
      `SELECT \`key\`, value FROM settings WHERE organization_id = ${org.id}`
    );
    const dict = {};
    settings.forEach(s => { dict[s.key] = s.value; });

    const updates = [];
    if (dict.description && !await columnHasValue('organizations', 'description', org.id))
      updates.push(`description = ${seq.escape(dict.description)}`);
    if (dict.address && !await columnHasValue('organizations', 'address', org.id))
      updates.push(`address = ${seq.escape(dict.address)}`);
    if (dict.phone && !await columnHasValue('organizations', 'phone', org.id))
      updates.push(`phone = ${seq.escape(dict.phone)}`);
    if (dict.hours && !await columnHasValue('organizations', 'opening_hours', org.id)) {
      // Copier seulement si c'est du JSON valide — sinon on laisse NULL
      try { JSON.parse(dict.hours); updates.push(`opening_hours = ${seq.escape(dict.hours)}`); } catch {}
    }

    if (updates.length > 0) {
      await seq.query(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ${org.id}`);
      console.log(`  ✓ Org ${org.id} : settings copiés vers colonnes`);
    }
  }

  console.log('\n✅ Migration v3 terminée avec succès.');
  await seq.close();
}

async function columnHasValue(table, column, id) {
  const [rows] = await seq.query(
    `SELECT \`${column}\` FROM \`${table}\` WHERE id = ${id} AND \`${column}\` IS NOT NULL LIMIT 1`
  );
  return rows.length > 0 && rows[0][column] !== null;
}

run().catch(err => {
  console.error('❌ Erreur migration v3 :', err.message);
  console.error(err.stack);
  process.exit(1);
});
