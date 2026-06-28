'use strict';

/**
 * Migration fidélisation intelligente — idempotente
 * Ajoute : birthday/segment sur users, loyalty_badges, user_badges,
 *           loyalty_rewards, colonnes coupons (personnalisation).
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: false }
);

async function colExists(table, col) {
  const [r] = await seq.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    { replacements: [table, col] }
  );
  return r.length > 0;
}
async function tableExists(name) {
  const [r] = await seq.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    { replacements: [name] }
  );
  return r.length > 0;
}
async function addCol(table, col, def) {
  if (await colExists(table, col)) { console.log(`  · ${table}.${col} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
  console.log(`  ✓ ${table}.${col} ajouté`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  // ── 1. Colonnes supplémentaires sur users ──────────────────────────────────
  console.log('── 1. users ──────────────────────────────────────────────────');
  await addCol('users', 'birthday', 'DATE DEFAULT NULL');
  await addCol('users', 'segment',
    "ENUM('new','regular','loyal','vip','inactive','at_risk') DEFAULT 'new'");

  // ── 2. loyalty_badges ─────────────────────────────────────────────────────
  console.log('\n── 2. loyalty_badges ─────────────────────────────────────────');
  if (!(await tableExists('loyalty_badges'))) {
    await seq.query(`
      CREATE TABLE loyalty_badges (
        id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id  INT UNSIGNED DEFAULT NULL,
        code             VARCHAR(64)  NOT NULL,
        name             VARCHAR(100) NOT NULL,
        icon             VARCHAR(10)  NOT NULL DEFAULT '🏅',
        description      VARCHAR(255) DEFAULT NULL,
        condition_type   ENUM('orders_count','total_spent','points_earned','birthday','manual') NOT NULL DEFAULT 'orders_count',
        condition_value  INT NOT NULL DEFAULT 1,
        points_bonus     INT NOT NULL DEFAULT 0,
        active           TINYINT(1) NOT NULL DEFAULT 1,
        created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_badge_org_code (organization_id, code),
        KEY idx_badge_org (organization_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ loyalty_badges créée');
  } else {
    console.log('  · loyalty_badges déjà présente');
  }

  // ── 3. user_badges ────────────────────────────────────────────────────────
  console.log('\n── 3. user_badges ────────────────────────────────────────────');
  if (!(await tableExists('user_badges'))) {
    await seq.query(`
      CREATE TABLE user_badges (
        id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id          INT UNSIGNED NOT NULL,
        badge_id         INT UNSIGNED NOT NULL,
        organization_id  INT UNSIGNED DEFAULT NULL,
        earned_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_ub_user_badge_org (user_id, badge_id, organization_id),
        KEY idx_ub_user (user_id),
        KEY idx_ub_badge (badge_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ user_badges créée');
  } else {
    console.log('  · user_badges déjà présente');
  }

  // ── 4. loyalty_rewards ────────────────────────────────────────────────────
  console.log('\n── 4. loyalty_rewards ────────────────────────────────────────');
  if (!(await tableExists('loyalty_rewards'))) {
    await seq.query(`
      CREATE TABLE loyalty_rewards (
        id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id  INT UNSIGNED NOT NULL,
        name             VARCHAR(100) NOT NULL,
        description      VARCHAR(255) DEFAULT NULL,
        icon             VARCHAR(10)  NOT NULL DEFAULT '🎁',
        points_cost      INT UNSIGNED NOT NULL,
        reward_type      ENUM('discount_percent','discount_fixed','free_item','delivery_free') NOT NULL,
        reward_value     DECIMAL(8,2) NOT NULL DEFAULT 0,
        min_order        DECIMAL(8,2) NOT NULL DEFAULT 0,
        stock            INT UNSIGNED DEFAULT NULL,
        used_count       INT UNSIGNED NOT NULL DEFAULT 0,
        active           TINYINT(1) NOT NULL DEFAULT 1,
        valid_days       INT UNSIGNED DEFAULT 30,
        created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_lr_org (organization_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ loyalty_rewards créée');
  } else {
    console.log('  · loyalty_rewards déjà présente');
  }

  // ── 5. loyalty_redemptions ─────────────────────────────────────────────────
  console.log('\n── 5. loyalty_redemptions ────────────────────────────────────');
  if (!(await tableExists('loyalty_redemptions'))) {
    await seq.query(`
      CREATE TABLE loyalty_redemptions (
        id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id          INT UNSIGNED NOT NULL,
        organization_id  INT UNSIGNED NOT NULL,
        reward_id        INT UNSIGNED NOT NULL,
        points_spent     INT NOT NULL,
        coupon_code      VARCHAR(32) DEFAULT NULL,
        status           ENUM('active','used','expired') NOT NULL DEFAULT 'active',
        expires_at       DATETIME DEFAULT NULL,
        used_at          DATETIME DEFAULT NULL,
        created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_lr_user (user_id),
        KEY idx_lr_org (organization_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ loyalty_redemptions créée');
  } else {
    console.log('  · loyalty_redemptions déjà présente');
  }

  // ── 6. Colonnes coupons (personnalisation) ────────────────────────────────
  console.log('\n── 6. coupons (extensions) ───────────────────────────────────');
  await addCol('coupons', 'description',    'VARCHAR(255) DEFAULT NULL');
  await addCol('coupons', 'user_id',        'INT UNSIGNED DEFAULT NULL');
  await addCol('coupons', 'target_segment', "ENUM('all','new','regular','loyal','vip','inactive','at_risk') DEFAULT 'all'");
  await addCol('coupons', 'auto_type',      "ENUM('manual','birthday','inactivity','levelup','welcome') DEFAULT 'manual'");

  // ── 7. loyalty_transactions.type extension ─────────────────────────────────
  console.log('\n── 7. loyalty_transactions (type extension) ──────────────────');
  try {
    await seq.query(`
      ALTER TABLE loyalty_transactions
      MODIFY COLUMN type ENUM('earn','spend','expire','bonus','birthday_bonus','levelup_bonus','reward_redemption') NOT NULL DEFAULT 'earn'
    `);
    console.log('  ✓ loyalty_transactions.type étendu');
  } catch (e) {
    if (e.message.includes('Duplicate')) { console.log('  · déjà étendu'); }
    else console.log('  · ' + e.message);
  }

  // ── 8. Badges par défaut (globaux) ────────────────────────────────────────
  console.log('\n── 8. Badges par défaut ──────────────────────────────────────');
  const defaultBadges = [
    { code: 'welcome',     name: 'Bienvenue',       icon: '👋', desc: 'Première commande passée',   type: 'orders_count', val: 1,  bonus: 50  },
    { code: 'loyal_5',     name: 'Habitué',          icon: '🌟', desc: '5 commandes complétées',      type: 'orders_count', val: 5,  bonus: 100 },
    { code: 'loyal_10',    name: 'Fidèle',           icon: '💎', desc: '10 commandes complétées',     type: 'orders_count', val: 10, bonus: 200 },
    { code: 'loyal_20',    name: 'VIP',              icon: '👑', desc: '20 commandes complétées',     type: 'orders_count', val: 20, bonus: 500 },
    { code: 'big_spender', name: 'Grand Gourmand',   icon: '🍽️', desc: '500 MAD de commandes cumulés',type: 'total_spent',  val: 500,bonus: 150 },
    { code: 'birthday',    name: 'Joyeux Anniversaire','icon': '🎂', desc: 'Badge anniversaire',    type: 'birthday',     val: 0,  bonus: 200 },
    { code: 'early_bird',  name: 'Lève-tôt',         icon: '🌅', desc: '1000 points gagnés',          type: 'points_earned',val: 1000,bonus: 0  },
  ];
  for (const b of defaultBadges) {
    const [existing] = await seq.query(
      'SELECT id FROM loyalty_badges WHERE code=? AND organization_id IS NULL',
      { replacements: [b.code] }
    );
    if (!existing.length) {
      await seq.query(
        `INSERT INTO loyalty_badges (organization_id, code, name, icon, description, condition_type, condition_value, points_bonus)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
        { replacements: [b.code, b.name, b.icon, b.desc, b.type, b.val, b.bonus] }
      );
      console.log(`  ✓ Badge "${b.name}" créé`);
    } else {
      console.log(`  · Badge "${b.name}" déjà présent`);
    }
  }

  console.log('\n✅ Migration fidélisation terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
