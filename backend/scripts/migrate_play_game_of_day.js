#!/usr/bin/env node
'use strict';
require('dotenv').config({path:require('path').join(__dirname,'../.env')});
const {Sequelize}=require('sequelize');
const seq=new Sequelize(process.env.DB_NAME,process.env.DB_USER,process.env.DB_PASS,{host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),dialect:'mysql',logging:false});
async function run(){
  await seq.authenticate();
  await seq.query("ALTER TABLE play_games ADD COLUMN is_game_of_day TINYINT(1) NOT NULL DEFAULT 0 AFTER is_hero");
  console.log('✓ iFilino Play "jeu du jour" migration complete');
  await seq.close();
}
run().catch(async error=>{console.error('✗',error.message);await seq.close().catch(()=>{});process.exit(1);});
