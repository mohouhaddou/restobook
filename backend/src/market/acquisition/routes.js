'use strict';

const express = require('express');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const campaignService = require('./services/campaignService');
const { runCampaign } = require('./services/discoveryEngine');
const { listSources, seedOpenStreetMapSource } = require('./services/sourceRegistry');
const { query } = require('./services/repository');
const candidateReviewService = require('./services/candidateReviewService');

const router = express.Router();
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireSuperAdmin);

router.get('/sources', ah(async (req, res) => {
  await seedOpenStreetMapSource({ reviewerId: req.user.id });
  res.json({ sources: await listSources() });
}));

router.post('/sources/seed-openstreetmap', ah(async (req, res) => {
  await seedOpenStreetMapSource({ reviewerId: req.user.id });
  res.status(201).json({ ok: true });
}));

router.post('/campaigns/estimate', ah(async (req, res) => {
  res.json({ estimate: await campaignService.estimateCampaign(req.body || {}) });
}));

router.post('/campaigns', ah(async (req, res) => {
  const campaign = await campaignService.createCampaign(req.body || {}, {
    userId: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json({ ok: true, campaign });
}));

router.get('/candidates', ah(async (req, res) => {
  const candidates = await candidateReviewService.listCandidates(req.query || {});
  res.json({ candidates });
}));

router.get('/candidates/stats', ah(async (req, res) => {
  res.json({ stats: await candidateReviewService.candidateStats() });
}));

router.get('/candidates/:id', ah(async (req, res) => {
  const candidate = await candidateReviewService.getCandidate(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Candidat introuvable' });
  res.json({ candidate });
}));

router.post('/candidates/:id/approve', ah(async (req, res) => {
  const candidate = await candidateReviewService.approveCandidate(req.params.id, { userId: req.user.id, notes: req.body?.notes || null });
  res.json({ ok: true, candidate });
}));

router.post('/candidates/:id/reject', ah(async (req, res) => {
  const candidate = await candidateReviewService.rejectCandidate(req.params.id, { userId: req.user.id, reason: req.body?.reason || null });
  res.json({ ok: true, candidate });
}));

router.post('/candidates/:id/publish', ah(async (req, res) => {
  const result = await candidateReviewService.publishCandidate(req.params.id, { userId: req.user.id });
  res.status(result.alreadyPublished ? 200 : 201).json({ ok: true, ...result });
}));

router.post('/candidates/bulk-reject', ah(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const result = await candidateReviewService.bulkRejectCandidates(ids, { userId: req.user.id, reason: req.body?.reason || null });
  res.json({ ok: true, ...result });
}));

router.post('/candidates/bulk-publish', ah(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const result = await candidateReviewService.bulkPublishCandidates(ids, { userId: req.user.id });
  res.json({ ok: true, ...result });
}));

router.get('/campaigns', ah(async (req, res) => {
  res.json({ campaigns: await campaignService.listCampaigns() });
}));

router.get('/campaigns/:id', ah(async (req, res) => {
  const campaign = await campaignService.getCampaign(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
  res.json({ campaign });
}));

router.post('/campaigns/:id/start', ah(async (req, res) => {
  const campaign = await campaignService.startCampaign(req.params.id, {
    userId: req.user.id,
    ipAddress: req.ip,
  });
  res.json({ ok: true, campaign });
}));

router.post('/campaigns/:id/pause', ah(async (req, res) => {
  const campaign = await campaignService.pauseCampaign(req.params.id, req.body?.reason || 'PAUSE_MANUAL', {
    userId: req.user.id,
    ipAddress: req.ip,
  });
  res.json({ ok: true, campaign });
}));

router.post('/campaigns/:id/resume', ah(async (req, res) => {
  const campaign = await campaignService.resumeCampaign(req.params.id, {
    userId: req.user.id,
    ipAddress: req.ip,
  });
  res.json({ ok: true, campaign });
}));

router.post('/campaigns/:id/run', ah(async (req, res) => {
  const summary = await runCampaign(req.params.id, { maxTasks: Number(req.body?.maxTasks || 3) });
  res.json({ ok: true, summary, metrics: await campaignService.getMetrics(req.params.id) });
}));

router.post('/campaigns/:id/stop', ah(async (req, res) => {
  const campaign = await campaignService.stopCampaign(req.params.id, req.body?.reason || 'STOP_MANUAL', {
    userId: req.user.id,
    ipAddress: req.ip,
  });
  res.json({ ok: true, campaign });
}));

router.delete('/campaigns/:id', ah(async (req, res) => {
  await campaignService.deleteCampaign(req.params.id, {
    userId: req.user.id,
    ipAddress: req.ip,
  });
  res.json({ ok: true });
}));

router.get('/campaigns/:id/cells', ah(async (req, res) => {
  res.json({ cells: await campaignService.getCampaignCells(req.params.id) });
}));

router.get('/campaigns/:id/tasks', ah(async (req, res) => {
  res.json({ tasks: await campaignService.getCampaignTasks(req.params.id) });
}));

router.get('/campaigns/:id/candidates', ah(async (req, res) => {
  res.json({ candidates: await campaignService.getCampaignCandidates(req.params.id) });
}));

router.get('/campaigns/:id/metrics', ah(async (req, res) => {
  res.json({ metrics: await campaignService.getMetrics(req.params.id) });
}));

router.get('/campaigns/:id/logs', ah(async (req, res) => {
  const logs = await query(
    'SELECT * FROM acquisition_audit_logs WHERE campaign_id=:id ORDER BY created_at DESC LIMIT 300',
    { id: req.params.id }
  );
  res.json({ logs });
}));

module.exports = router;
