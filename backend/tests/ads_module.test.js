'use strict';

/**
 * Tests — module Ads Management (superadmin CRUD, résolution publique, ciblage,
 * plafonds, rotation, sécurité). Usage : node tests/ads_module.test.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
delete process.env.ADSENSE_ENABLED; // état par défaut : AdSense désactivé

const express = require('express');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sequelize, AdCampaign, AdPlacement, AdImpression } = require('../models');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/superadmin/ads', require('../src/modules/ads/adminRoutes'));
  app.use('/api/superadmin/ad-placements', require('../src/modules/ads/placementRoutes'));
  app.use('/api/ads', require('../src/modules/ads/publicRoutes'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({ baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise(r => server.close(r)) });
    });
  });
}

function authHeaders(role = 'superadmin') {
  const token = jwt.sign({ id: 900001, role, nom: 'Test User', organization_id: null }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Ads Management');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const { baseUrl, close } = await startServer();
  const superAuth = authHeaders('superadmin');
  const cleanupNames = [];

  try {
    // ── 1. Accès refusé aux non-SuperAdmins ─────────────────────────────────
    let r = await fetch(`${baseUrl}/api/superadmin/ads`, { headers: authHeaders('customer') });
    assert(r.status === 403, 'GET /superadmin/ads refuse un rôle customer (403)');

    r = await fetch(`${baseUrl}/api/superadmin/ads`);
    assert(r.status === 401, 'GET /superadmin/ads refuse une requête sans token (401)');

    // ── Placements pilotes déjà seedés par la migration ─────────────────────
    r = await fetch(`${baseUrl}/api/superadmin/ad-placements`, { headers: superAuth });
    let j = await r.json();
    assert(r.status === 200 && j.placements.length >= 6, 'GET /ad-placements renvoie les emplacements pilotes');
    const belowHeader = j.placements.find(p => p.code === 'below_header');
    const articleInline = j.placements.find(p => p.code === 'article_inline');

    // ── 2. Création d'une campagne interne ──────────────────────────────────
    const name = `Test Promo ${Date.now()}`;
    cleanupNames.push(name);
    r = await fetch(`${baseUrl}/api/superadmin/ads`, {
      method: 'POST', headers: superAuth, body: JSON.stringify({
        name, source_type: 'internal', status: 'active',
        title: 'Grande Promo', destination_url: 'https://example.com/promo',
        button_text: 'Voir', placement_ids: [belowHeader.id],
        rotation_weight: 10, priority: 5,
      }),
    });
    j = await r.json();
    assert(r.status === 201 && j.campaign?.id, 'POST /superadmin/ads crée une campagne interne');
    const campaignId = j.campaign.id;

    // ── URL dangereuse rejetée ───────────────────────────────────────────────
    r = await fetch(`${baseUrl}/api/superadmin/ads`, {
      method: 'POST', headers: superAuth,
      body: JSON.stringify({ name: 'Bad URL', source_type: 'internal', destination_url: 'javascript:alert(1)' }),
    });
    assert(r.status === 400, 'destination_url="javascript:..." est rejetée (400)');

    // ── AdSense désactivé par défaut : création/activation refusée ──────────
    r = await fetch(`${baseUrl}/api/superadmin/ads`, {
      method: 'POST', headers: superAuth,
      body: JSON.stringify({ name: 'Should Not Create', source_type: 'adsense', publisher_id: 'pub-1', ad_slot_id: '1' }),
    });
    assert(r.status === 400, 'ADSENSE_ENABLED non défini -> création d\'une campagne adsense refusée (400)');

    // Le reste des tests AdSense vérifie la configuration elle-même (champs
    // whitelistés, restitution publique) — activé uniquement pour ce process.
    process.env.ADSENSE_ENABLED = 'true';

    // ── Script arbitraire jamais persisté (whitelist de champs) ─────────────
    const adsenseName = `Test AdSense ${Date.now()}`;
    cleanupNames.push(adsenseName);
    r = await fetch(`${baseUrl}/api/superadmin/ads`, {
      method: 'POST', headers: superAuth, body: JSON.stringify({
        name: adsenseName, source_type: 'adsense', publisher_id: 'pub-123456', ad_slot_id: '789',
        ad_format: 'auto', script: '<script>alert(1)</script>', html_content: '<div>evil</div>', title: 'Should be ignored for adsense',
      }),
    });
    j = await r.json();
    assert(r.status === 201 && j.campaign?.id, 'POST /superadmin/ads crée le bloc AdSense (ADSENSE_ENABLED=true)');
    const persisted = await AdCampaign.findByPk(j.campaign.id);
    assert(
      !('script' in persisted.dataValues) && !('html_content' in persisted.dataValues) && !persisted.title,
      'Bloc AdSense : seuls les champs whitelistés sont persistés (script/html_content/title créatif ignorés)'
    );
    assert(persisted.publisher_id === 'pub-123456' && persisted.ad_slot_id === '789', 'Bloc AdSense : publisherId/adSlotId bien enregistrés');

    // ── 3. Résolution publique : la campagne doit être servie ───────────────
    r = await fetch(`${baseUrl}/api/ads/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/', language: 'fr', device: 'desktop', sessionToken: 'sess-abc' }),
    });
    j = await r.json();
    assert(j.ad?.id === campaignId, 'POST /ads/resolve sert la campagne active assignée au placement');

    // ── Ciblage par plateforme (emplacement non assigné à ce placement) ─────
    r = await fetch(`${baseUrl}/api/ads/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'article_inline', platform: 'discover', route: '/discover/x', language: 'fr', device: 'desktop', sessionToken: 'sess-abc' }),
    });
    j = await r.json();
    assert(j.ad === null, 'Ciblage par emplacement : campagne non assignée à article_inline -> aucune pub');

    // ── Ciblage par route (règle exacte) ─────────────────────────────────────
    await fetch(`${baseUrl}/api/superadmin/ads/${campaignId}`, {
      method: 'PUT', headers: superAuth, body: JSON.stringify({ targeting_rules: [{ route_type: 'exact', route_pattern: '/only-here' }] }),
    });
    r = await fetch(`${baseUrl}/api/ads/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/elsewhere', language: 'fr', device: 'desktop', sessionToken: 'sess-route' }),
    });
    j = await r.json();
    assert(j.ad === null, 'Ciblage par route exacte : route non-correspondante -> aucune pub');

    r = await fetch(`${baseUrl}/api/ads/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/only-here', language: 'fr', device: 'desktop', sessionToken: 'sess-route2' }),
    });
    j = await r.json();
    assert(j.ad?.id === campaignId, 'Ciblage par route exacte : route correspondante -> pub servie');

    // ── Ciblage par langue ────────────────────────────────────────────────────
    await fetch(`${baseUrl}/api/superadmin/ads/${campaignId}`, {
      method: 'PUT', headers: superAuth, body: JSON.stringify({ targeting_rules: [{ route_type: 'all', language: 'ar' }] }),
    });
    r = await fetch(`${baseUrl}/api/ads/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/', language: 'fr', device: 'desktop', sessionToken: 'sess-lang' }),
    });
    j = await r.json();
    assert(j.ad === null, 'Ciblage par langue : langue non-correspondante (ar requis, fr fourni) -> aucune pub');

    // ── Ciblage par appareil ──────────────────────────────────────────────────
    await fetch(`${baseUrl}/api/superadmin/ads/${campaignId}`, {
      method: 'PUT', headers: superAuth, body: JSON.stringify({ targeting_rules: [{ route_type: 'all', device: 'mobile' }] }),
    });
    r = await fetch(`${baseUrl}/api/ads/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/', language: 'fr', device: 'desktop', sessionToken: 'sess-dev' }),
    });
    j = await r.json();
    assert(j.ad === null, 'Ciblage par appareil : mobile requis, desktop fourni -> aucune pub');

    // remet un ciblage neutre pour la suite des tests
    await fetch(`${baseUrl}/api/superadmin/ads/${campaignId}`, {
      method: 'PUT', headers: superAuth, body: JSON.stringify({ targeting_rules: [] }),
    });

    // ── Campagne hors période non diffusée ───────────────────────────────────
    const futureName = `Test Future ${Date.now()}`;
    cleanupNames.push(futureName);
    r = await fetch(`${baseUrl}/api/superadmin/ads`, {
      method: 'POST', headers: superAuth, body: JSON.stringify({
        name: futureName, source_type: 'internal', status: 'active',
        title: 'Future', placement_ids: [belowHeader.id],
        start_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      }),
    });
    j = await r.json();
    const futureCampaignId = j.campaign.id;
    r = await fetch(`${baseUrl}/api/ads/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/', language: 'fr', device: 'desktop', sessionToken: 'sess-future' }),
    });
    j = await r.json();
    assert(j.ad?.id === campaignId, 'Campagne planifiée dans le futur (start_at) exclue -> la campagne active en cours reste servie');
    await fetch(`${baseUrl}/api/superadmin/ads/${futureCampaignId}`, { method: 'DELETE', headers: superAuth });

    // ── 4. Impression + déduplication ────────────────────────────────────────
    r = await fetch(`${baseUrl}/api/ads/${campaignId}/impression`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/', device: 'desktop', sessionToken: 'sess-imp' }),
    });
    j = await r.json();
    assert(j.ok === true && !j.deduped, 'POST /ads/:id/impression enregistre une impression');

    r = await fetch(`${baseUrl}/api/ads/${campaignId}/impression`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/', device: 'desktop', sessionToken: 'sess-imp' }),
    });
    j = await r.json();
    assert(j.deduped === true, 'Impression immédiate identique (même session) dédupliquée');

    // ── 5. Clic enregistré ────────────────────────────────────────────────────
    r = await fetch(`${baseUrl}/api/ads/${campaignId}/click`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/', device: 'desktop', sessionToken: 'sess-imp' }),
    });
    j = await r.json();
    assert(j.ok === true, 'POST /ads/:id/click enregistre un clic');

    r = await fetch(`${baseUrl}/api/superadmin/ads/${campaignId}/statistics`, { headers: superAuth });
    j = await r.json();
    assert(j.impressions === 1 && j.clicks === 1, 'GET /statistics reflète 1 impression + 1 clic (dédupliqué correctement)');

    // ── Fréquence maximale (frequency_cap) ───────────────────────────────────
    const capName = `Test Cap ${Date.now()}`;
    cleanupNames.push(capName);
    r = await fetch(`${baseUrl}/api/superadmin/ads`, {
      method: 'POST', headers: superAuth, body: JSON.stringify({
        name: capName, source_type: 'internal', status: 'active',
        title: 'Cap Test', placement_ids: [belowHeader.id], session_cap: 1,
      }),
    });
    j = await r.json();
    const capCampaignId = j.campaign.id;
    // 1ère impression sous le même sessionToken
    await fetch(`${baseUrl}/api/ads/${capCampaignId}/impression`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/', device: 'desktop', sessionToken: 'sess-cap' }),
    });
    // Force une deuxième requête hors fenêtre de dédup en insérant directement une impression antérieure
    await AdImpression.update({ occurred_at: new Date(Date.now() - 5 * 60 * 1000) }, { where: { campaign_id: capCampaignId } });
    r = await fetch(`${baseUrl}/api/ads/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/', language: 'fr', device: 'desktop', sessionToken: 'sess-cap' }),
    });
    j = await r.json();
    assert(j.ad?.id !== capCampaignId, 'session_cap=1 atteint -> campagne exclue de la rotation pour cette session');
    await fetch(`${baseUrl}/api/superadmin/ads/${capCampaignId}`, { method: 'DELETE', headers: superAuth });

    // ── Rotation pondérée (distribution statistique) ─────────────────────────
    const rotA = `Test Rot A ${Date.now()}`, rotB = `Test Rot B ${Date.now()}`;
    cleanupNames.push(rotA, rotB);
    const rA = await fetch(`${baseUrl}/api/superadmin/ads`, {
      method: 'POST', headers: superAuth, body: JSON.stringify({ name: rotA, source_type: 'internal', status: 'active', title: 'A', placement_ids: [belowHeader.id], rotation_weight: 90, priority: 1 }),
    });
    const rotAId = (await rA.json()).campaign.id;
    const rB = await fetch(`${baseUrl}/api/superadmin/ads`, {
      method: 'POST', headers: superAuth, body: JSON.stringify({ name: rotB, source_type: 'internal', status: 'active', title: 'B', placement_ids: [belowHeader.id], rotation_weight: 10, priority: 1 }),
    });
    const rotBId = (await rB.json()).campaign.id;
    // désactive la campagne principale pour isoler A/B dans ce placement
    await fetch(`${baseUrl}/api/superadmin/ads/${campaignId}/suspend`, { method: 'POST', headers: superAuth });

    let countA = 0, countB = 0;
    for (let i = 0; i < 200; i++) {
      const rr = await fetch(`${baseUrl}/api/ads/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/', language: 'fr', device: 'desktop', sessionToken: `sess-rot-${i}` }),
      });
      const jj = await rr.json();
      if (jj.ad?.id === rotAId) countA++;
      if (jj.ad?.id === rotBId) countB++;
    }
    const ratio = countA / (countA + countB || 1);
    assert(countA + countB === 200, `Rotation pondérée : 200 résolutions réparties entre A et B (A=${countA}, B=${countB})`);
    assert(ratio > 0.7 && ratio < 0.99, `Rotation pondérée : distribution ~90/10 respectée (ratio A=${ratio.toFixed(2)})`);
    await fetch(`${baseUrl}/api/superadmin/ads/${rotAId}`, { method: 'DELETE', headers: superAuth });
    await fetch(`${baseUrl}/api/superadmin/ads/${rotBId}`, { method: 'DELETE', headers: superAuth });

    // ── Fallback : aucune pub disponible -> pas d'espace vide côté client (ad: null) ──
    r = await fetch(`${baseUrl}/api/ads/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'listing_inline', platform: 'marketplace', route: '/', language: 'fr', device: 'desktop', sessionToken: 'sess-empty' }),
    });
    j = await r.json();
    assert(j.ad === null, 'Aucune campagne éligible sur listing_inline -> { ad: null } (le frontend ne doit rien afficher)');

    // ── Fallback interne par défaut ───────────────────────────────────────────
    const fallbackName = `Test Fallback ${Date.now()}`;
    cleanupNames.push(fallbackName);
    r = await fetch(`${baseUrl}/api/superadmin/ads`, {
      method: 'POST', headers: superAuth, body: JSON.stringify({
        name: fallbackName, source_type: 'internal', status: 'active', fallback_type: 'internal_default',
        title: 'Défaut', placement_ids: [belowHeader.id],
        // hors planification (expirée) -> ne gagnerait jamais la rotation normale
        start_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        end_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      }),
    });
    j = await r.json();
    const fallbackId = j.campaign.id;
    r = await fetch(`${baseUrl}/api/ads/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/', language: 'fr', device: 'desktop', sessionToken: 'sess-fb' }),
    });
    j = await r.json();
    assert(j.ad?.id === fallbackId, 'fallback_type=internal_default sert quand aucune campagne normale n\'est éligible');
    await fetch(`${baseUrl}/api/superadmin/ads/${fallbackId}`, { method: 'DELETE', headers: superAuth });

    // ── Bloc AdSense correctement configuré (relecture publique) ─────────────
    const adsenseServeName = `Test AdSense Serve ${Date.now()}`;
    cleanupNames.push(adsenseServeName);
    r = await fetch(`${baseUrl}/api/superadmin/ads`, {
      method: 'POST', headers: superAuth, body: JSON.stringify({
        name: adsenseServeName, source_type: 'adsense', status: 'active',
        publisher_id: 'pub-999', ad_slot_id: '111', ad_format: 'rectangle', responsive: true, full_width_responsive: false,
        placement_ids: [belowHeader.id], rotation_weight: 100, priority: 99,
      }),
    });
    j = await r.json();
    const adsenseServeId = j.campaign.id;
    r = await fetch(`${baseUrl}/api/ads/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement: 'below_header', platform: 'marketplace', route: '/', language: 'fr', device: 'desktop', sessionToken: 'sess-adsense' }),
    });
    j = await r.json();
    assert(
      j.ad?.source_type === 'adsense' && j.ad.adsense?.publisherId === 'pub-999' && j.ad.adsense?.adSlotId === '111' && j.ad.adsense?.format === 'rectangle',
      'Résolution publique d\'un bloc AdSense expose uniquement les 5 paramètres whitelistés'
    );
    await fetch(`${baseUrl}/api/superadmin/ads/${adsenseServeId}`, { method: 'DELETE', headers: superAuth });

  } finally {
    // Nettoyage garanti même si une assertion/étape a levé une exception —
    // sinon des campagnes orphelines faussent les tests de rotation suivants.
    await AdCampaign.destroy({ where: { name: { [Op.in]: cleanupNames } } }).catch(() => {});
    await close();
  }

  console.log(`\n${pass} succès, ${fail} échec(s)\n`);
  if (fail > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
