#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Sequelize } = require('sequelize');
const seq = new Sequelize(process.env.DB_NAME,process.env.DB_USER,process.env.DB_PASS,{host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),dialect:'mysql',logging:false});
async function columnExists(table,column){const [rows]=await seq.query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',{replacements:[table,column]});return rows.length>0;}
async function addColumn(table,column,definition){if(await columnExists(table,column))return;await seq.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);}
async function run(){await seq.authenticate();
  await seq.query("ALTER TABLE play_games MODIFY game_type ENUM('2048','memory','puzzle_image','quiz','true_false','geo_quiz','guess_place','memory_cards','reaction_test','color_match') NOT NULL");
  await addColumn('play_questions','translations','JSON DEFAULT NULL'); await addColumn('play_questions','explanation','TEXT DEFAULT NULL'); await addColumn('play_questions','explanation_translations','JSON DEFAULT NULL'); await addColumn('play_questions','discover_url','VARCHAR(500) DEFAULT NULL'); await addColumn('play_answers','translations','JSON DEFAULT NULL');
  const games=[
    ['memory-cards','Memory Cards','Retrouvez toutes les paires avec le moins de mouvements.','memory_cards','▦',20],
    ['reaction-test','Reaction Test','Mesurez vos réflexes en cinq manches.','reaction_test','⚡',21],
    ['color-match','Color Match','Identifiez la couleur réelle du texte.','color_match','◉',22],
  ];
  for(const [slug,name,description,type,icon,order] of games) await seq.query(`INSERT INTO play_games (slug,name,description,game_type,icon,sort_order,active) VALUES (:slug,:name,:description,:type,:icon,:order,1) ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),game_type=VALUES(game_type),active=1`,{replacements:{slug,name,description,type,icon,order}});
  const [quizzes]=await seq.query("SELECT id FROM play_quizzes WHERE slug='quiz-maroc-culture-1' LIMIT 1");
  if(quizzes[0]){
    const [questions]=await seq.query('SELECT id,sort_order FROM play_questions WHERE quiz_id=? ORDER BY sort_order',{replacements:[quizzes[0].id]});
    const content=[
      {q:{fr:'Quelle est la capitale du Maroc ?',ar:'ما هي عاصمة المغرب؟',en:'What is the capital of Morocco?'},ex:{fr:'Rabat est la capitale administrative du Maroc depuis 1912.',ar:'الرباط هي العاصمة الإدارية للمغرب منذ عام 1912.',en:'Rabat has been Morocco’s administrative capital since 1912.'},url:'/discover/culture',answers:{Rabat:{ar:'الرباط',en:'Rabat'},Casablanca:{ar:'الدار البيضاء',en:'Casablanca'},Marrakech:{ar:'مراكش',en:'Marrakesh'},Fès:{ar:'فاس',en:'Fez'}}},
      {q:{fr:'Quelle mer borde Tanger ?',ar:'أي بحر يحد مدينة طنجة؟',en:'Which sea borders Tangier?'},ex:{fr:'Tanger se trouve au détroit de Gibraltar, entre la Méditerranée et l’Atlantique.',ar:'تقع طنجة على مضيق جبل طارق بين البحر الأبيض المتوسط والمحيط الأطلسي.',en:'Tangier sits on the Strait of Gibraltar between the Mediterranean and Atlantic.'},url:'/discover/voyage',answers:{Méditerranée:{ar:'البحر الأبيض المتوسط',en:'Mediterranean Sea'},'Mer Rouge':{ar:'البحر الأحمر',en:'Red Sea'},'Mer Noire':{ar:'البحر الأسود',en:'Black Sea'},'Mer Baltique':{ar:'بحر البلطيق',en:'Baltic Sea'}}},
    ];
    for(let i=0;i<Math.min(questions.length,content.length);i++){const item=content[i],qid=questions[i].id;await seq.query('UPDATE play_questions SET translations=:tr, explanation=:explanation, explanation_translations=:etr, discover_url=:url WHERE id=:id',{replacements:{tr:JSON.stringify({ar:item.q.ar,en:item.q.en}),explanation:item.ex.fr,etr:JSON.stringify({ar:item.ex.ar,en:item.ex.en}),url:item.url,id:qid}});const [answers]=await seq.query('SELECT id,answer_text FROM play_answers WHERE question_id=?',{replacements:[qid]});for(const answer of answers){const tr=item.answers[answer.answer_text];if(tr)await seq.query('UPDATE play_answers SET translations=? WHERE id=?',{replacements:[JSON.stringify(tr),answer.id]});}}
  }
  console.log('✓ iFilino Play Phase B migration complete'); await seq.close();
}
run().catch(async error=>{console.error('✗',error.message);await seq.close().catch(()=>{});process.exit(1);});
