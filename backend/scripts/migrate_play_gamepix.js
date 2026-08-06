#!/usr/bin/env node
'use strict';
require('dotenv').config({path:require('path').join(__dirname,'../.env')});
const {Sequelize}=require('sequelize');
const seq=new Sequelize(process.env.DB_NAME,process.env.DB_USER,process.env.DB_PASS,{host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),dialect:'mysql',logging:false});
async function run(){
  await seq.authenticate();
  await seq.query("ALTER TABLE play_games MODIFY game_type ENUM('2048','memory','puzzle_image','quiz','true_false','geo_quiz','guess_place','memory_cards','reaction_test','color_match','bubble_pop','brick_smash','tower_stack','penalty_master','snake','gamepix') NOT NULL");
  await seq.query(`
    INSERT INTO play_providers (code, name, description, base_url, launch_mode, license_type, license_reference, supports_mobile, supports_fullscreen, has_ads, active, created_at, updated_at)
    VALUES ('gamepix', 'GamePix', 'Catalogue de jeux HTML5 GamePix (feed sid=1I687), monétisés par publicité partagée.', 'https://play.gamepix.com', 'iframe', 'revenue_share', '1I687', 1, 1, 1, 1, NOW(), NOW())
    ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), base_url=VALUES(base_url), launch_mode=VALUES(launch_mode), license_type=VALUES(license_type), license_reference=VALUES(license_reference), has_ads=VALUES(has_ads), active=VALUES(active), updated_at=NOW()
  `);
  console.log('✓ iFilino Play GamePix migration complete');
  await seq.close();
}
run().catch(async error=>{console.error('✗',error.message);await seq.close().catch(()=>{});process.exit(1);});
