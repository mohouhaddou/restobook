#!/usr/bin/env node
'use strict';
require('dotenv').config({path:require('path').join(__dirname,'../.env')});
const {Sequelize}=require('sequelize');
const seq=new Sequelize(process.env.DB_NAME,process.env.DB_USER,process.env.DB_PASS,{host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),dialect:'mysql',logging:false});

const SID = '1I687';
const TOP_N = 50;
const FEED_URL = `https://feeds.gamepix.com/v2/json?sid=${SID}&pagination=96&page=1`;

async function run(){
  await seq.authenticate();
  const [[provider]] = await seq.query("SELECT id FROM play_providers WHERE code='gamepix'");
  if (!provider) throw new Error("Provider 'gamepix' introuvable — lancer d'abord migrate:play:gamepix");

  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Feed GamePix HTTP ${res.status}`);
  const feed = await res.json();
  const top = [...feed.items].sort((a, b) => b.quality_score - a.quality_score).slice(0, TOP_N);

  let i = 0;
  for (const item of top) {
    const slug = item.namespace;
    const name = item.title.slice(0, 100);
    const description = (item.description || '').slice(0, 255);
    const thumbnail = item.banner_image || item.image || null;
    const category = (item.category || 'other').slice(0, 64);
    const mobile = item.orientation !== 'landscape';
    await seq.query(`
      INSERT INTO play_games (slug, name, description, game_type, icon, config, source, provider_id, launch_url, thumbnail_url, category, difficulty, supports_mobile, supports_keyboard, supports_fullscreen, active, sort_order, created_at)
      VALUES (:slug, :name, :description, 'gamepix', '🎮', NULL, 'partner', :providerId, :launchUrl, :thumbnail, :category, 'medium', :mobile, 0, 1, 1, :sortOrder, NOW())
      ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), game_type='gamepix', source='partner', provider_id=VALUES(provider_id), launch_url=VALUES(launch_url), thumbnail_url=VALUES(thumbnail_url), category=VALUES(category), supports_mobile=VALUES(supports_mobile), active=1, sort_order=VALUES(sort_order)
    `, {
      replacements: {
        slug, name, description,
        providerId: provider.id,
        launchUrl: item.url,
        thumbnail,
        category,
        mobile,
        sortOrder: 1000 + i,
      },
    });
    i += 1;
  }

  console.log(`✓ Import GamePix terminé : ${top.length} jeux (provider #${provider.id})`);
  await seq.close();
}
run().catch(async error=>{console.error('✗',error.message);await seq.close().catch(()=>{});process.exit(1);});
