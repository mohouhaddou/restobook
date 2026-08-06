'use strict';
require('dotenv').config();
const path=require('path');
const fs=require('fs');
const crypto=require('crypto');
const sharp=require('sharp');
const {sequelize}=require('../models');
const {QueryTypes}=require('sequelize');

async function run(){
  const tx=await sequelize.transaction();
  try{
    const [seriesId]=await sequelize.query(`INSERT INTO comic_series
      (slug,title,subtitle,synopsis,cover_url,banner_url,language,age_rating,status,genres,tags,seo_title,seo_description,published_at,created_at,updated_at)
      VALUES ('saladin','Saladin','Episode 01 — The illustrated chronicle','A cinematic historical comic following Saladin through courage, strategy, and the making of a lasting legacy.','/uploads/comics/series/saladin/episode-1/front-cover.png','/uploads/comics/series/saladin/episode-1/page-001.png','en','13+','published','[\"Historical\",\"Adventure\"]','[\"Saladin\",\"History\"]','Saladin — Historical Comic | iFilino Comics','Read Saladin, an illustrated historical adventure on iFilino Comics.',NOW(),NOW(),NOW())
      ON DUPLICATE KEY UPDATE title=VALUES(title),cover_url=VALUES(cover_url),banner_url=VALUES(banner_url),status='published',published_at=COALESCE(published_at,NOW()),updated_at=NOW()`,{transaction:tx,type:QueryTypes.INSERT});
    const rows=await sequelize.query("SELECT id FROM comic_series WHERE slug='saladin' LIMIT 1",{transaction:tx,type:QueryTypes.SELECT});
    const sid=rows[0].id;
    await sequelize.query(`INSERT INTO comic_episodes (series_id,number,slug,title,status,language,page_count,reading_modes,published_at,created_at,updated_at)
      VALUES (:sid,1,'episode-1','Episode 01','published','en',16,'[\"classic\",\"vertical\"]',NOW(),NOW(),NOW())
      ON DUPLICATE KEY UPDATE status='published',page_count=16,published_at=COALESCE(published_at,NOW()),updated_at=NOW()`,{replacements:{sid},transaction:tx,type:QueryTypes.INSERT});
    const episodes=await sequelize.query("SELECT id FROM comic_episodes WHERE series_id=:sid AND slug='episode-1' LIMIT 1",{replacements:{sid},transaction:tx,type:QueryTypes.SELECT});
    const eid=episodes[0].id; const root=path.join(__dirname,'../uploads/comics/series/saladin/episode-1');
    for(let number=1;number<=16;number++){
      const name=`page-${String(number).padStart(3,'0')}.png`;const file=path.join(root,name);const data=fs.readFileSync(file);const meta=await sharp(data).metadata();const checksum=crypto.createHash('sha256').update(data).digest('hex');
      await sequelize.query(`INSERT INTO comic_pages (episode_id,page_number,image_url,width,height,bytes,checksum,created_at,updated_at)
        VALUES (:eid,:number,:url,:width,:height,:bytes,:checksum,NOW(),NOW()) ON DUPLICATE KEY UPDATE image_url=VALUES(image_url),width=VALUES(width),height=VALUES(height),bytes=VALUES(bytes),checksum=VALUES(checksum),updated_at=NOW()`,{replacements:{eid,number,url:`/uploads/comics/series/saladin/episode-1/${name}`,width:meta.width||null,height:meta.height||null,bytes:data.length,checksum},transaction:tx,type:QueryTypes.INSERT});
    }
    await sequelize.query("UPDATE comic_import_jobs SET status='imported', summary=JSON_SET(COALESCE(summary,JSON_OBJECT()),'$.seriesId',:sid,'$.episodeId',:eid,'$.pageCount',16,'$.published',true), updated_at=NOW() WHERE id='b07bccb7-abd7-4dea-8f59-059f6cc5e4bf'",{replacements:{sid,eid},transaction:tx});
    await tx.commit();console.log(JSON.stringify({seriesId:sid,episodeId:eid,pages:16,status:'published'}));
  }catch(error){await tx.rollback();throw error}finally{await sequelize.close()}
}
run().catch(error=>{console.error(error);process.exitCode=1});
