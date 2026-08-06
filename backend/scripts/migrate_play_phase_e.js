#!/usr/bin/env node
'use strict';
require('dotenv').config({path:require('path').join(__dirname,'../.env')});
const {Sequelize}=require('sequelize');
const seq=new Sequelize(process.env.DB_NAME,process.env.DB_USER,process.env.DB_PASS,{host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),dialect:'mysql',logging:false});
async function run(){await seq.authenticate();await seq.query("ALTER TABLE play_games MODIFY game_type ENUM('2048','memory','puzzle_image','quiz','true_false','geo_quiz','guess_place','memory_cards','reaction_test','color_match','bubble_pop','brick_smash','tower_stack','penalty_master','snake') NOT NULL");await seq.query("INSERT INTO play_games (slug,name,description,game_type,icon,sort_order,active) VALUES ('snake','Snake','Faites grandir le serpent sans toucher les murs ni sa queue.','snake','S',34,1) ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),game_type=VALUES(game_type),active=1");console.log('✓ iFilino Play Snake migration complete');await seq.close();}
run().catch(async error=>{console.error('✗',error.message);await seq.close().catch(()=>{});process.exit(1);});
