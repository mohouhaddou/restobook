'use strict';
const { sequelize } = require('../models');

async function migrate() {
  const q = (sql) => sequelize.query(sql, { raw: true });

  console.log('📦 Creating subscription_plans table...');
  await q(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id                     INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      name                   VARCHAR(100) NOT NULL,
      slug                   VARCHAR(50)  NOT NULL UNIQUE,
      description            TEXT,
      price_monthly          DECIMAL(10,2) DEFAULT 0.00,
      price_yearly           DECIMAL(10,2) DEFAULT 0.00,
      max_restaurants        INT DEFAULT 1   COMMENT '-1 = illimité',
      max_users              INT DEFAULT 5   COMMENT '-1 = illimité',
      max_orders_per_month   INT DEFAULT 100 COMMENT '-1 = illimité',
      has_ai_features        TINYINT(1) DEFAULT 0,
      has_exports            TINYINT(1) DEFAULT 0,
      has_advanced_dashboard TINYINT(1) DEFAULT 0,
      has_loyalty_module     TINYINT(1) DEFAULT 0,
      has_delivery_module    TINYINT(1) DEFAULT 0,
      has_canteen_module     TINYINT(1) DEFAULT 0,
      has_nutrition_ai       TINYINT(1) DEFAULT 0,
      has_api_access         TINYINT(1) DEFAULT 0,
      is_active              TINYINT(1) DEFAULT 1,
      is_popular             TINYINT(1) DEFAULT 0,
      color                  VARCHAR(20)  DEFAULT '#64748B',
      icon                   VARCHAR(10)  DEFAULT '📦',
      sort_order             INT          DEFAULT 0,
      features               JSON,
      created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log('📋 Creating user_subscriptions table...');
  await q(`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id    INT UNSIGNED NOT NULL,
      plan_id            INT UNSIGNED NOT NULL,
      status             ENUM('active','cancelled','expired','trial','pending') DEFAULT 'trial',
      billing_cycle      ENUM('monthly','yearly') DEFAULT 'monthly',
      started_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at         TIMESTAMP NULL,
      cancelled_at       TIMESTAMP NULL,
      trial_ends_at      TIMESTAMP NULL,
      payment_reference  VARCHAR(255) NULL,
      notes              TEXT NULL,
      created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id)         REFERENCES subscription_plans(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log('🌱 Seeding plans...');
  await q(`
    INSERT IGNORE INTO subscription_plans
      (id, name, slug, description, price_monthly, price_yearly,
       max_restaurants, max_users, max_orders_per_month,
       has_ai_features, has_exports, has_advanced_dashboard,
       has_loyalty_module, has_delivery_module, has_canteen_module,
       has_nutrition_ai, has_api_access,
       is_active, is_popular, color, icon, sort_order, features)
    VALUES
    (1,'Free Demo','free_demo',
     'Découvrez RestoBook sans engagement',
     0,0, 1,3,50, 0,0,0, 0,0,0, 0,0, 1,0,'#64748B','🆓',1,
     '["1 restaurant","3 utilisateurs","50 commandes/mois","Marketplace public","Support email"]'),

    (2,'Basic','basic',
     'Idéal pour un restaurant indépendant',
     199,1790, 1,10,500, 0,1,0, 0,1,0, 0,0, 1,0,'#3B82F6','🍽️',2,
     '["1 restaurant","10 utilisateurs","500 commandes/mois","Exports PDF","Module livraison","Support prioritaire"]'),

    (3,'Pro','pro',
     'Pour les restaurants en croissance',
     499,4490, 3,25,2000, 1,1,1, 1,1,0, 1,0, 1,1,'#F97316','🚀',3,
     '["3 restaurants","25 utilisateurs","2 000 commandes/mois","IA & Nutrition","Dashboard avancé","Module fidélité","Exports complets","Support dédié"]'),

    (4,'Canteen','canteen',
     'Solution complète pour cantines entreprises & écoles',
     699,6290, 2,200,-1, 1,1,1, 1,0,1, 1,0, 1,0,'#22C55E','🏢',4,
     '["2 cantines","200 utilisateurs","Commandes illimitées","Menus scolaires","QR Code ordering","IA nutritionnelle","Rapports RH","Support premium"]'),

    (5,'Enterprise','enterprise',
     'Solution sur mesure pour les grands groupes',
     0,0, -1,-1,-1, 1,1,1, 1,1,1, 1,1, 1,0,'#8B5CF6','🏆',5,
     '["Restaurants illimités","Utilisateurs illimités","Commandes illimitées","Accès API complet","Toutes les fonctionnalités","SLA garanti","Support 24/7","Intégrations custom"]')
  `);

  console.log('🔗 Assigning Free Demo to existing orgs without subscription...');
  await q(`
    INSERT IGNORE INTO user_subscriptions (organization_id, plan_id, status, trial_ends_at)
    SELECT o.id, 1, 'trial', DATE_ADD(NOW(), INTERVAL 30 DAY)
    FROM organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM user_subscriptions us WHERE us.organization_id = o.id
    )
  `);

  console.log('✅ Migration subscriptions terminée.');
  process.exit(0);
}

migrate().catch(e => { console.error('❌', e.message); process.exit(1); });
