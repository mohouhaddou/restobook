'use strict';
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../../models');
const { requireAuth, requireRole } = require('../../../middleware/auth');
const PackageExtractor=require('./importer/PackageExtractor');
const {ManifestValidator}=require('./importer/ManifestValidator');
const ImportLogger=require('./importer/ImportLogger');

const router = express.Router();
const importsDir = path.join(__dirname, '../../../uploads/comics/imports');
fs.mkdirSync(importsDir, { recursive: true });
const upload = multer({ storage: multer.diskStorage({ destination: importsDir, filename: (_req,file,done) => done(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`) }), limits:{ fileSize:250*1024*1024, files:1 } });
const ah = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const adminOnly = [requireAuth, requireRole(['superadmin'])];
const publisherOnly = [requireAuth, requireRole(['publisher','superadmin'])];

async function scalar(sql, replacements={}) { const rows=await sequelize.query(sql,{replacements,type:QueryTypes.SELECT}); return Number(rows[0]?.value||0); }

router.get('/admin/overview', ...adminOnly, ah(async (_req,res) => {
  const [series,episodes,pages,publishers,users,reports,views] = await Promise.all([
    scalar('SELECT COUNT(*) value FROM comic_series'), scalar('SELECT COUNT(*) value FROM comic_episodes'), scalar('SELECT COUNT(*) value FROM comic_pages'),
    scalar('SELECT COUNT(*) value FROM comic_publishers'), scalar('SELECT COUNT(*) value FROM users'), scalar("SELECT COUNT(*) value FROM comic_import_jobs WHERE status IN ('invalid','failed')"),
    scalar('SELECT COALESCE(SUM(view_count),0) value FROM comic_series')
  ]);
  const top = await sequelize.query('SELECT id,slug,title,status,view_count,follower_count,cover_url,updated_at FROM comic_series ORDER BY view_count DESC, updated_at DESC LIMIT 8',{type:QueryTypes.SELECT});
  const activity = await sequelize.query('SELECT id,source_type,original_name,status,bytes,created_at,summary FROM comic_import_jobs ORDER BY created_at DESC LIMIT 8',{type:QueryTypes.SELECT});
  res.json({ metrics:{series,episodes,pages,publishers,users,reports,views,activeReaders:0,registrations:0,storageBytes:activity.reduce((n,r)=>n+Number(r.bytes||0),0)}, top, activity });
}));

router.get('/admin/series', ...adminOnly, ah(async (req,res) => {
  const limit=Math.min(100,Math.max(1,Number(req.query.limit)||30)); const offset=Math.max(0,Number(req.query.offset)||0);
  const rows=await sequelize.query(`SELECT s.*,p.name publisher_name,(SELECT COUNT(*) FROM comic_episodes e WHERE e.series_id=s.id) episode_count FROM comic_series s LEFT JOIN comic_publishers p ON p.id=s.publisher_id ORDER BY s.updated_at DESC LIMIT ${limit} OFFSET ${offset}`,{type:QueryTypes.SELECT});
  res.json({items:rows,limit,offset});
}));

router.get('/admin/episodes', ...adminOnly, ah(async (_req,res) => {
 const items=await sequelize.query(`SELECT e.id,e.episode_uid,e.number,e.title,e.status,e.language,e.page_count,e.episode_version,e.publication_order,e.cover_image,e.updated_at,s.id series_db_id,s.series_uid,s.title series_title,s.season_number,s.genres,s.cover_url series_cover FROM comic_episodes e JOIN comic_series s ON s.id=e.series_id ORDER BY s.title ASC,COALESCE(e.publication_order,e.number) ASC`,{type:QueryTypes.SELECT});res.json({items});
}));

router.get('/publisher/overview', ...publisherOnly, ah(async (req,res) => {
  const publisher=await sequelize.query('SELECT * FROM comic_publishers WHERE user_id=:userId LIMIT 1',{replacements:{userId:req.user.id},type:QueryTypes.SELECT});
  if(!publisher[0] && req.user.role!=='superadmin') return res.status(404).json({error:'Publisher profile not found'});
  const publisherId=publisher[0]?.id||Number(req.query.publisher_id)||0;
  const items=await sequelize.query('SELECT * FROM comic_series WHERE publisher_id=:publisherId ORDER BY updated_at DESC',{replacements:{publisherId},type:QueryTypes.SELECT});
  res.json({publisher:publisher[0]||null,metrics:{series:items.length,views:items.reduce((n,x)=>n+Number(x.view_count||0),0),followers:items.reduce((n,x)=>n+Number(x.follower_count||0),0),drafts:items.filter(x=>x.status==='draft').length},items});
}));

router.post('/admin/imports', ...adminOnly, upload.single('package'), ah(async (req,res) => {
  if(!req.file)return res.status(400).json({error:'Comic package file is required'});
  const ext=path.extname(req.file.originalname).toLowerCase(),id=crypto.randomUUID(),logger=new ImportLogger();let errors=[],warnings=[],manifest=null,summary={},packageVersion=null;
  if(!['.zip','.pdf'].includes(ext))errors.push('Only .zip and .pdf files are accepted.');
  if(ext==='.pdf'){summary={series:path.basename(req.file.originalname,ext),language:'Not declared',estimatedStorage:req.file.size,legacy:true};warnings.push('PDF packages use the legacy importer.');logger.add('Legacy PDF package detected.');}
  else if(!errors.length){try{logger.add('ZIP integrity verified.');const inspected=PackageExtractor.inspect(req.file.path);logger.add('Manifest detected.');if(Number(inspected.manifest.packageVersion)===1){manifest=inspected.manifest;packageVersion=1;summary={series:manifest.seriesTitle||path.basename(req.file.originalname,ext),language:manifest.language||'Not declared',packageVersion:1,legacy:true,estimatedStorage:req.file.size,manifest};logger.add('Legacy package v1 selected.')}else{manifest=ManifestValidator.validate(inspected.manifest);packageVersion=manifest.packageVersion;logger.add('Manifest validated.',{seriesId:manifest.seriesId,episodeId:manifest.episodeId,episodeVersion:manifest.episodeVersion});summary={series:manifest.seriesTitle,seriesId:manifest.seriesId,episode:manifest.episodeTitle,episodeId:manifest.episodeId,episodeNumber:manifest.episodeNumber,episodeVersion:manifest.episodeVersion,seasonNumber:manifest.seasonNumber,publicationOrder:manifest.publicationOrder,language:manifest.language,publisher:manifest.publisher||'iFilino Comics',generatedAt:manifest.generatedAt,packageVersion,estimatedStorage:req.file.size,manifest}};}catch(error){errors=error.errors||[error.message];logger.add('Package validation failed.',{errors});}}
  const status=errors.length?'invalid':'ready_for_review',sourceType=ext==='.pdf'?'pdf':'ifilino_zip';
  await sequelize.query('INSERT INTO comic_import_jobs (id,requested_by,source_type,original_name,stored_path,status,summary,warnings,errors,bytes,package_version,series_uid,episode_uid,import_log) VALUES (:id,:userId,:sourceType,:name,:storedPath,:status,:summary,:warnings,:errors,:bytes,:packageVersion,:seriesUid,:episodeUid,:log)',{replacements:{id,userId:req.user.id,sourceType,name:req.file.originalname,storedPath:req.file.path,status,summary:JSON.stringify(summary),warnings:JSON.stringify(warnings),errors:JSON.stringify(errors),bytes:req.file.size,packageVersion,seriesUid:manifest?.seriesId||null,episodeUid:manifest?.episodeId||null,log:JSON.stringify(logger.json())},type:QueryTypes.INSERT});
  res.status(errors.length?422:201).json({id,status,summary,warnings,errors,packageVersion,manifest,log:logger.json()});
}));

router.post('/admin/imports-legacy-disabled', ...adminOnly, upload.single('package'), ah(async (req,res) => {
  if(!req.file) return res.status(400).json({error:'Comic package file is required'});
  const ext=path.extname(req.file.originalname).toLowerCase(); const head=Buffer.alloc(5); const fd=fs.openSync(req.file.path,'r'); fs.readSync(fd,head,0,5,0); fs.closeSync(fd);
  const zip=head[0]===0x50&&head[1]===0x4b; const pdf=head.toString('ascii',0,5)==='%PDF-';
  const errors=[]; if(!['.zip','.pdf'].includes(ext)) errors.push('Only .zip and .pdf files are accepted.'); if(ext==='.zip'&&!zip) errors.push('ZIP signature is invalid.'); if(ext==='.pdf'&&!pdf) errors.push('PDF signature is invalid.');
  const id=crypto.randomUUID(); const status=errors.length?'invalid':'ready_for_review'; const sourceType=ext==='.pdf'?'pdf':'ifilino_zip';
  const summary={series:path.basename(req.file.originalname,ext),language:'Not declared',pageCount:null,estimatedStorage:req.file.size,automaticPublication:false};
  await sequelize.query('INSERT INTO comic_import_jobs (id,requested_by,source_type,original_name,stored_path,status,summary,warnings,errors,bytes) VALUES (:id,:userId,:sourceType,:name,:storedPath,:status,:summary,:warnings,:errors,:bytes)',{replacements:{id,userId:req.user.id,sourceType,name:req.file.originalname,storedPath:req.file.path,status,summary:JSON.stringify(summary),warnings:JSON.stringify([]),errors:JSON.stringify(errors),bytes:req.file.size},type:QueryTypes.INSERT});
  res.status(errors.length?422:201).json({id,status,summary,warnings:[],errors});
}));

router.get('/admin/imports/:id', ...adminOnly, ah(async (req,res) => { const rows=await sequelize.query('SELECT * FROM comic_import_jobs WHERE id=:id',{replacements:{id:req.params.id},type:QueryTypes.SELECT}); if(!rows[0])return res.status(404).json({error:'Import not found'});res.json(rows[0]); }));

module.exports = router;
