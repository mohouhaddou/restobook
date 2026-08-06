#!/usr/bin/env node
'use strict';

/**
 * Migration iFilino Play — idempotente.
 * Crée le moteur de gamification partagé : play_games, play_badges,
 * play_user_badges, play_levels, play_xp, play_quizzes, play_questions,
 * play_answers, play_daily_missions, play_user_missions, play_rewards,
 * play_user_rewards, play_sessions, play_scores, play_statistics.
 *
 * Seed : 50 niveaux (courbe triangulaire xp_threshold(N)=100*N*(N+1)/2),
 * 6 jeux, 7 badges (mapping condition_type documenté dans le plan), 4 missions
 * quotidiennes, un jeu de quiz/questions/réponses par catégorie couvrant
 * chaque question_type (multiple_choice / true_false / guess_place) pour que
 * l'API soit testable de bout en bout dès l'installation.
 *
 * Usage : node scripts/migrate_play_engine.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: false }
);

async function tableExists(name) {
  const [r] = await seq.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    { replacements: [name] }
  );
  return r.length > 0;
}
async function createTableIfMissing(name, ddl) {
  if (await tableExists(name)) { console.log(`  · ${name} déjà présente`); return; }
  await seq.query(ddl);
  console.log(`  ✓ ${name} créée`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. play_games ─────────────────────────────────────────────────');
  await createTableIfMissing('play_games', `
    CREATE TABLE play_games (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug             VARCHAR(64) NOT NULL,
      name             VARCHAR(100) NOT NULL,
      description      VARCHAR(255) DEFAULT NULL,
      game_type        ENUM('2048','memory','puzzle_image','quiz','true_false','geo_quiz','guess_place') NOT NULL,
      icon             VARCHAR(10) DEFAULT '🎮',
      config           JSON DEFAULT NULL,
      organization_id  INT UNSIGNED DEFAULT NULL,
      active           TINYINT(1) NOT NULL DEFAULT 1,
      sort_order       INT NOT NULL DEFAULT 0,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_play_games_slug (slug),
      KEY idx_play_games_org (organization_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. play_badges ────────────────────────────────────────────────');
  await createTableIfMissing('play_badges', `
    CREATE TABLE play_badges (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id  INT UNSIGNED DEFAULT NULL,
      code             VARCHAR(64) NOT NULL,
      name             VARCHAR(100) NOT NULL,
      icon             VARCHAR(10) DEFAULT '🏅',
      description      VARCHAR(255) DEFAULT NULL,
      condition_type   ENUM('games_played_count','score_threshold','puzzle_completed_count','quiz_correct_count','category_wins','time_window_sessions','daily_streak','manual') NOT NULL DEFAULT 'manual',
      condition_value  INT NOT NULL DEFAULT 1,
      condition_meta   JSON DEFAULT NULL,
      xp_bonus         INT NOT NULL DEFAULT 0,
      icoins_bonus     INT NOT NULL DEFAULT 0,
      active           TINYINT(1) NOT NULL DEFAULT 1,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_play_badges_code (code),
      KEY idx_play_badges_org (organization_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 3. play_levels ────────────────────────────────────────────────');
  await createTableIfMissing('play_levels', `
    CREATE TABLE play_levels (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      level_number     INT UNSIGNED NOT NULL,
      xp_threshold     INT UNSIGNED NOT NULL,
      name             VARCHAR(60) DEFAULT NULL,
      icon             VARCHAR(10) DEFAULT NULL,
      badge_reward_id  INT UNSIGNED DEFAULT NULL,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_play_levels_number (level_number),
      CONSTRAINT fk_play_levels_badge FOREIGN KEY (badge_reward_id) REFERENCES play_badges(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 4. play_user_badges ───────────────────────────────────────────');
  await createTableIfMissing('play_user_badges', `
    CREATE TABLE play_user_badges (
      id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id    INT UNSIGNED DEFAULT NULL,
      guest_id   CHAR(36) DEFAULT NULL,
      badge_id   INT UNSIGNED NOT NULL,
      earned_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_play_user_badges_user (user_id, badge_id),
      UNIQUE KEY uq_play_user_badges_guest (guest_id, badge_id),
      CONSTRAINT fk_play_user_badges_badge FOREIGN KEY (badge_id) REFERENCES play_badges(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 5. play_xp ────────────────────────────────────────────────────');
  await createTableIfMissing('play_xp', `
    CREATE TABLE play_xp (
      id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id               INT UNSIGNED DEFAULT NULL,
      guest_id              CHAR(36) DEFAULT NULL,
      display_name          VARCHAR(40) DEFAULT NULL,
      avatar_icon           VARCHAR(10) DEFAULT NULL,
      total_xp              INT UNSIGNED NOT NULL DEFAULT 0,
      current_level         INT UNSIGNED NOT NULL DEFAULT 1,
      icoins_balance        INT UNSIGNED NOT NULL DEFAULT 0,
      icoins_lifetime       INT UNSIGNED NOT NULL DEFAULT 0,
      current_streak_days   INT UNSIGNED NOT NULL DEFAULT 0,
      longest_streak_days   INT UNSIGNED NOT NULL DEFAULT 0,
      last_played_date      DATE DEFAULT NULL,
      created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_play_xp_user (user_id),
      UNIQUE KEY uq_play_xp_guest (guest_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 6. play_quizzes ───────────────────────────────────────────────');
  await createTableIfMissing('play_quizzes', `
    CREATE TABLE play_quizzes (
      id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
      game_id              INT UNSIGNED NOT NULL,
      slug                 VARCHAR(80) NOT NULL,
      title                VARCHAR(150) NOT NULL,
      description          VARCHAR(255) DEFAULT NULL,
      category             ENUM('quiz_maroc','culture','geography','gastronomy','history','sport') NOT NULL,
      difficulty           ENUM('easy','medium','hard') NOT NULL DEFAULT 'medium',
      time_limit_seconds   INT UNSIGNED DEFAULT 20,
      icon                 VARCHAR(10) DEFAULT NULL,
      cover_image_url      VARCHAR(500) DEFAULT NULL,
      active               TINYINT(1) NOT NULL DEFAULT 1,
      sort_order           INT NOT NULL DEFAULT 0,
      created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_play_quizzes_slug (slug),
      CONSTRAINT fk_play_quizzes_game FOREIGN KEY (game_id) REFERENCES play_games(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 7. play_questions ─────────────────────────────────────────────');
  await createTableIfMissing('play_questions', `
    CREATE TABLE play_questions (
      id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
      quiz_id         INT UNSIGNED NOT NULL,
      question_type   ENUM('multiple_choice','true_false','guess_place') NOT NULL DEFAULT 'multiple_choice',
      question_text   TEXT NOT NULL,
      image_url       VARCHAR(500) DEFAULT NULL,
      difficulty      ENUM('easy','medium','hard') DEFAULT NULL,
      points          INT UNSIGNED NOT NULL DEFAULT 10,
      correct_lat     DECIMAL(10,7) DEFAULT NULL,
      correct_lng     DECIMAL(10,7) DEFAULT NULL,
      location_name   VARCHAR(150) DEFAULT NULL,
      tolerance_km    DECIMAL(6,2) DEFAULT 5,
      sort_order      INT NOT NULL DEFAULT 0,
      active          TINYINT(1) NOT NULL DEFAULT 1,
      created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_play_questions_quiz (quiz_id),
      CONSTRAINT fk_play_questions_quiz FOREIGN KEY (quiz_id) REFERENCES play_quizzes(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 8. play_answers ───────────────────────────────────────────────');
  await createTableIfMissing('play_answers', `
    CREATE TABLE play_answers (
      id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
      question_id  INT UNSIGNED NOT NULL,
      answer_text  VARCHAR(255) NOT NULL,
      is_correct   TINYINT(1) NOT NULL DEFAULT 0,
      city_lat     DECIMAL(10,7) DEFAULT NULL,
      city_lng     DECIMAL(10,7) DEFAULT NULL,
      sort_order   INT NOT NULL DEFAULT 0,
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_play_answers_question (question_id),
      CONSTRAINT fk_play_answers_question FOREIGN KEY (question_id) REFERENCES play_questions(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 9. play_daily_missions ────────────────────────────────────────');
  await createTableIfMissing('play_daily_missions', `
    CREATE TABLE play_daily_missions (
      id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
      code           VARCHAR(64) NOT NULL,
      title          VARCHAR(150) NOT NULL,
      description    VARCHAR(255) DEFAULT NULL,
      icon           VARCHAR(10) DEFAULT NULL,
      mission_type   ENUM('play_games_count','win_games_count','quiz_correct_count','specific_game','earn_xp','earn_icoins') NOT NULL,
      target_value   INT UNSIGNED NOT NULL,
      game_id        INT UNSIGNED DEFAULT NULL,
      xp_reward      INT UNSIGNED NOT NULL DEFAULT 0,
      icoins_reward  INT UNSIGNED NOT NULL DEFAULT 0,
      active         TINYINT(1) NOT NULL DEFAULT 1,
      created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_play_daily_missions_code (code),
      CONSTRAINT fk_play_daily_missions_game FOREIGN KEY (game_id) REFERENCES play_games(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 10. play_user_missions ────────────────────────────────────────');
  await createTableIfMissing('play_user_missions', `
    CREATE TABLE play_user_missions (
      id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id         INT UNSIGNED DEFAULT NULL,
      guest_id        CHAR(36) DEFAULT NULL,
      mission_id      INT UNSIGNED NOT NULL,
      mission_date    DATE NOT NULL,
      progress_value  INT UNSIGNED NOT NULL DEFAULT 0,
      status          ENUM('in_progress','completed','claimed') NOT NULL DEFAULT 'in_progress',
      completed_at    DATETIME DEFAULT NULL,
      claimed_at      DATETIME DEFAULT NULL,
      created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_play_user_missions_user (user_id, mission_id, mission_date),
      UNIQUE KEY uq_play_user_missions_guest (guest_id, mission_id, mission_date),
      CONSTRAINT fk_play_user_missions_mission FOREIGN KEY (mission_id) REFERENCES play_daily_missions(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 11. play_rewards ──────────────────────────────────────────────');
  await createTableIfMissing('play_rewards', `
    CREATE TABLE play_rewards (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id  INT UNSIGNED DEFAULT NULL,
      name             VARCHAR(100) NOT NULL,
      description      VARCHAR(255) DEFAULT NULL,
      icon             VARCHAR(10) DEFAULT '🎁',
      cost_icoins      INT UNSIGNED NOT NULL,
      reward_type      ENUM('discount_percent','discount_fixed','free_item','delivery_free','cosmetic') NOT NULL,
      reward_value     DECIMAL(8,2) NOT NULL DEFAULT 0,
      stock            INT UNSIGNED DEFAULT NULL,
      used_count       INT UNSIGNED NOT NULL DEFAULT 0,
      max_per_user     INT UNSIGNED DEFAULT 1,
      valid_days       INT UNSIGNED NOT NULL DEFAULT 30,
      active           TINYINT(1) NOT NULL DEFAULT 1,
      sort_order       INT NOT NULL DEFAULT 0,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_play_rewards_org (organization_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 12. play_user_rewards ─────────────────────────────────────────');
  await createTableIfMissing('play_user_rewards', `
    CREATE TABLE play_user_rewards (
      id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id        INT UNSIGNED DEFAULT NULL,
      guest_id       CHAR(36) DEFAULT NULL,
      reward_id      INT UNSIGNED NOT NULL,
      icoins_spent   INT UNSIGNED NOT NULL,
      coupon_code    VARCHAR(32) DEFAULT NULL,
      status         ENUM('active','used','expired') NOT NULL DEFAULT 'active',
      expires_at     DATETIME DEFAULT NULL,
      used_at        DATETIME DEFAULT NULL,
      created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_play_user_rewards_user (user_id),
      CONSTRAINT fk_play_user_rewards_reward FOREIGN KEY (reward_id) REFERENCES play_rewards(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 13. play_sessions ─────────────────────────────────────────────');
  await createTableIfMissing('play_sessions', `
    CREATE TABLE play_sessions (
      id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id            INT UNSIGNED DEFAULT NULL,
      guest_id           CHAR(36) DEFAULT NULL,
      game_id            INT UNSIGNED NOT NULL,
      quiz_id            INT UNSIGNED DEFAULT NULL,
      started_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at           DATETIME DEFAULT NULL,
      duration_seconds   INT UNSIGNED DEFAULT NULL,
      status             ENUM('started','completed','abandoned') NOT NULL DEFAULT 'started',
      device_type        ENUM('mobile','desktop','tablet') DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_play_sessions_player (user_id, guest_id),
      KEY idx_play_sessions_game (game_id),
      CONSTRAINT fk_play_sessions_game FOREIGN KEY (game_id) REFERENCES play_games(id),
      CONSTRAINT fk_play_sessions_quiz FOREIGN KEY (quiz_id) REFERENCES play_quizzes(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 14. play_scores ───────────────────────────────────────────────');
  await createTableIfMissing('play_scores', `
    CREATE TABLE play_scores (
      id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id            INT UNSIGNED DEFAULT NULL,
      guest_id           CHAR(36) DEFAULT NULL,
      game_id            INT UNSIGNED NOT NULL,
      session_id         INT UNSIGNED DEFAULT NULL,
      quiz_id            INT UNSIGNED DEFAULT NULL,
      score              INT UNSIGNED NOT NULL,
      max_score          INT UNSIGNED DEFAULT NULL,
      correct_answers    INT UNSIGNED DEFAULT NULL,
      total_questions    INT UNSIGNED DEFAULT NULL,
      duration_seconds   INT UNSIGNED DEFAULT NULL,
      difficulty         ENUM('easy','medium','hard') DEFAULT NULL,
      xp_earned          INT UNSIGNED NOT NULL DEFAULT 0,
      icoins_earned      INT UNSIGNED NOT NULL DEFAULT 0,
      meta               JSON DEFAULT NULL,
      played_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_play_scores_player (user_id, guest_id),
      KEY idx_play_scores_game (game_id),
      KEY idx_play_scores_quiz (quiz_id),
      CONSTRAINT fk_play_scores_game FOREIGN KEY (game_id) REFERENCES play_games(id),
      CONSTRAINT fk_play_scores_session FOREIGN KEY (session_id) REFERENCES play_sessions(id),
      CONSTRAINT fk_play_scores_quiz FOREIGN KEY (quiz_id) REFERENCES play_quizzes(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 15. play_statistics ───────────────────────────────────────────');
  await createTableIfMissing('play_statistics', `
    CREATE TABLE play_statistics (
      id                              INT UNSIGNED NOT NULL AUTO_INCREMENT,
      stat_date                       DATE DEFAULT NULL,
      scope                           ENUM('daily','global') NOT NULL,
      organization_id                 INT UNSIGNED DEFAULT NULL,
      games_played_count              INT UNSIGNED NOT NULL DEFAULT 0,
      unique_players_count            INT UNSIGNED NOT NULL DEFAULT 0,
      unique_guests_count             INT UNSIGNED NOT NULL DEFAULT 0,
      xp_distributed                  INT UNSIGNED NOT NULL DEFAULT 0,
      icoins_distributed              INT UNSIGNED NOT NULL DEFAULT 0,
      avg_session_duration_seconds    INT UNSIGNED NOT NULL DEFAULT 0,
      top_game_id                     INT UNSIGNED DEFAULT NULL,
      computed_at                     DATETIME DEFAULT NULL,
      created_at                      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_play_statistics (stat_date, scope, organization_id),
      CONSTRAINT fk_play_statistics_game FOREIGN KEY (top_game_id) REFERENCES play_games(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 16. Seed play_levels (courbe triangulaire, 50 niveaux) ───────');
  const [levelCount] = await seq.query('SELECT COUNT(*) AS c FROM play_levels');
  if (Number(levelCount[0].c) > 0) {
    console.log('  · niveaux déjà seedés');
  } else {
    const levelNames = [
      [1, 'Débutant'], [5, 'Joueur'], [10, 'Expert'], [20, 'Champion'], [35, 'Légende'],
    ];
    const nameFor = (n) => {
      let name = 'Débutant';
      for (const [threshold, label] of levelNames) if (n >= threshold) name = label;
      return name;
    };
    const rows = [];
    for (let n = 1; n <= 50; n++) {
      const xpThreshold = Math.round(100 * n * (n + 1) / 2);
      rows.push(`(${n}, ${xpThreshold}, '${nameFor(n)}', NULL)`);
    }
    await seq.query(`INSERT INTO play_levels (level_number, xp_threshold, name, badge_reward_id) VALUES ${rows.join(',')}`);
    console.log('  ✓ 50 niveaux seedés');
  }

  console.log('\n── 17. Seed play_games (6 jeux) ──────────────────────────────────');
  const [gameCount] = await seq.query('SELECT COUNT(*) AS c FROM play_games');
  if (Number(gameCount[0].c) > 0) {
    console.log('  · jeux déjà seedés');
  } else {
    await seq.query(`
      INSERT INTO play_games (slug, name, description, game_type, icon, sort_order) VALUES
      ('2048', '2048', 'Fusionnez les tuiles jusqu''à atteindre 2048.', '2048', '🔢', 1),
      ('memory', 'Memory', 'Retrouvez les paires en un minimum de coups.', 'memory', '🧠', 2),
      ('puzzle-image', 'Puzzle', 'Reconstituez une image d''un lieu à découvrir.', 'puzzle_image', '🧩', 3),
      ('quiz-maroc', 'Quiz Maroc', 'Testez vos connaissances sur le Maroc.', 'quiz', '🇲🇦', 4),
      ('vrai-faux', 'Vrai / Faux', 'Répondez vite, répondez juste.', 'true_false', '❓', 5),
      ('guess-place', 'Guess the Place', 'Devinez le lieu sur la carte.', 'guess_place', '🗺️', 6)
    `);
    console.log('  ✓ 6 jeux seedés');
  }

  console.log('\n── 18. Seed play_badges (7 badges) ───────────────────────────────');
  const [badgeCount] = await seq.query('SELECT COUNT(*) AS c FROM play_badges');
  if (Number(badgeCount[0].c) > 0) {
    console.log('  · badges déjà seedés');
  } else {
    await seq.query(`
      INSERT INTO play_badges (code, name, icon, description, condition_type, condition_value, condition_meta, xp_bonus, icoins_bonus) VALUES
      ('explorateur', 'Explorateur', '🏖', 'Avoir joué à 6 jeux différents.', 'games_played_count', 6, NULL, 50, 30),
      ('aventurier', 'Aventurier', '🏔', 'Score ≥ 90 sur Guess the Place.', 'score_threshold', 90, JSON_OBJECT('game_slug','guess-place'), 50, 30),
      ('puzzle-master', 'Puzzle Master', '🧩', '20 puzzles complétés.', 'puzzle_completed_count', 20, JSON_OBJECT('game_slug','puzzle-image'), 80, 50),
      ('quiz-expert', 'Quiz Expert', '🧠', '100 bonnes réponses en quiz.', 'quiz_correct_count', 100, NULL, 80, 50),
      ('gourmet', 'Gourmet', '🍽', '15 quiz gastronomie réussis.', 'category_wins', 15, JSON_OBJECT('category','gastronomy'), 60, 40),
      ('coffee-lover', 'Coffee Lover', '☕', '5 parties jouées entre 6h et 9h.', 'time_window_sessions', 5, JSON_OBJECT('start','06:00','end','09:00'), 30, 20),
      ('daily-player', 'Daily Player', '🎯', '7 jours de connexion consécutifs.', 'daily_streak', 7, NULL, 100, 60)
    `);
    console.log('  ✓ 7 badges seedés');
  }

  console.log('\n── 19. Seed play_daily_missions (4 missions) ─────────────────────');
  const [missionCount] = await seq.query('SELECT COUNT(*) AS c FROM play_daily_missions');
  if (Number(missionCount[0].c) > 0) {
    console.log('  · missions déjà seedées');
  } else {
    await seq.query(`
      INSERT INTO play_daily_missions (code, title, description, icon, mission_type, target_value, xp_reward, icoins_reward) VALUES
      ('daily-3-quiz', 'Faire 3 quiz', 'Terminez 3 quiz aujourd''hui.', '🧠', 'quiz_correct_count', 3, 30, 20),
      ('daily-1-puzzle', 'Résoudre un puzzle', 'Terminez un puzzle image.', '🧩', 'play_games_count', 1, 20, 15),
      ('daily-1-win', 'Gagner une partie', 'Remportez une partie, tous jeux confondus.', '🏆', 'win_games_count', 1, 20, 15),
      ('daily-200-xp', 'Obtenir 200 XP', 'Cumulez 200 XP aujourd''hui.', '⭐', 'earn_xp', 200, 30, 20)
    `);
    console.log('  ✓ 4 missions seedées');
  }

  console.log('\n── 20. Seed quiz/questions/réponses (jeu de démonstration) ──────');
  const [quizCount] = await seq.query('SELECT COUNT(*) AS c FROM play_quizzes');
  if (Number(quizCount[0].c) > 0) {
    console.log('  · quiz déjà seedés');
  } else {
    const [[quizGame]] = await seq.query(`SELECT id FROM play_games WHERE slug='quiz-maroc'`);
    const [[tfGame]] = await seq.query(`SELECT id FROM play_games WHERE slug='vrai-faux'`);
    const [[guessGame]] = await seq.query(`SELECT id FROM play_games WHERE slug='guess-place'`);

    await seq.query(`
      INSERT INTO play_quizzes (id, game_id, slug, title, description, category, difficulty, time_limit_seconds, icon) VALUES
      (1, ${quizGame.id}, 'quiz-maroc-culture-1', 'Culture générale Maroc', 'Un premier quiz sur le Maroc.', 'quiz_maroc', 'easy', 20, '🇲🇦'),
      (2, ${tfGame.id}, 'vrai-faux-maroc-1', 'Vrai ou Faux — Maroc', 'Répondez par vrai ou faux.', 'culture', 'easy', 15, '❓'),
      (3, ${guessGame.id}, 'guess-place-villes-1', 'Devine la ville', 'Identifiez les villes marocaines.', 'geography', 'medium', 25, '🗺️')
    `);

    // Quiz 1 — multiple_choice
    await seq.query(`
      INSERT INTO play_questions (id, quiz_id, question_type, question_text, points, sort_order) VALUES
      (1, 1, 'multiple_choice', 'Quelle est la capitale du Maroc ?', 10, 1),
      (2, 1, 'multiple_choice', 'Quelle mer borde Tanger ?', 10, 2)
    `);
    await seq.query(`
      INSERT INTO play_answers (question_id, answer_text, is_correct, sort_order) VALUES
      (1, 'Rabat', 1, 1), (1, 'Casablanca', 0, 2), (1, 'Marrakech', 0, 3), (1, 'Fès', 0, 4),
      (2, 'Méditerranée', 1, 1), (2, 'Mer Rouge', 0, 2), (2, 'Mer Noire', 0, 3), (2, 'Mer Baltique', 0, 4)
    `);

    // Quiz 2 — true_false
    await seq.query(`
      INSERT INTO play_questions (id, quiz_id, question_type, question_text, points, sort_order) VALUES
      (3, 2, 'true_false', 'Le thé à la menthe est une boisson traditionnelle marocaine.', 10, 1)
    `);
    await seq.query(`
      INSERT INTO play_answers (question_id, answer_text, is_correct, sort_order) VALUES
      (3, 'Vrai', 1, 1), (3, 'Faux', 0, 2)
    `);

    // Quiz 3 — guess_place (carte + QCM 4 villes)
    await seq.query(`
      INSERT INTO play_questions (id, quiz_id, question_type, question_text, points, correct_lat, correct_lng, location_name, tolerance_km, sort_order) VALUES
      (4, 3, 'guess_place', 'Où se situe Chefchaouen, la ville bleue ?', 20, 35.1688, -5.2636, 'Chefchaouen', 5, 1)
    `);
    await seq.query(`
      INSERT INTO play_answers (question_id, answer_text, is_correct, city_lat, city_lng, sort_order) VALUES
      (4, 'Chefchaouen', 1, 35.1688, -5.2636, 1),
      (4, 'Essaouira', 0, 31.5085, -9.7595, 2),
      (4, 'Ouarzazate', 0, 30.9189, -6.8934, 3),
      (4, 'Oujda', 0, 34.6805, -1.9086, 4)
    `);

    await seq.query(`ALTER TABLE play_quizzes AUTO_INCREMENT = 4`);
    await seq.query(`ALTER TABLE play_questions AUTO_INCREMENT = 5`);
    console.log('  ✓ 3 quiz / 4 questions / 14 réponses seedés (un exemple par question_type)');
  }

  console.log('\n✅ Migration iFilino Play terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
