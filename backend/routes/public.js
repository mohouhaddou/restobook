// backend/routes/public.js — Paramètres publics (sans auth)
'use strict';

const express = require('express');
const router = express.Router();
const { Setting } = require('../models');

const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
const DEFAULT_LOGO = process.env.DEFAULT_LOGO_URL || '/brand/restobook_light.png';
const DEFAULT_PRIMARY = process.env.DEFAULT_THEME_PRIMARY || '#EA580C';
const DEFAULT_ACCENT = process.env.DEFAULT_THEME_ACCENT || '#16A34A';
const absolutize = p => {
  if (!p || /^https?:\/\//i.test(p)) return p;
  const normalized = p.startsWith('/brand/') ? `/restobook${p}` : (p.startsWith('/') ? p : `/${p}`);
  return `${PUBLIC_BASE}${normalized}`;
};
const isHexColor = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// GET /api/settings  (public, sans auth)
// Charge les settings de l'org id=1 (org par défaut) ou param ?org_id=
router.get('/settings', async (req, res) => {
  try {
    const orgId = Number(req.query.org_id || 1);
    const rows  = await Setting.findAll({ where: { organization_id: orgId }, attributes: ['key', 'value'] });
    const dict  = Object.fromEntries(rows.map(r => [r.key, r.value]));

    const cutoff_time        = dict.cutoff_time        || process.env.CUTOFF_TIME        || '10:30';
    const allow_cancel_until = dict.allow_cancel_until || process.env.ALLOW_CANCEL_UNTIL || '10:00';
    const hero_image_url     = absolutize(dict.hero_image_url || '/img/hero.jpg');
    const brand_logo_url     = absolutize(dict.brand_logo_url || DEFAULT_LOGO);
    const brand_name         = dict.brand_name || 'RestoBook';
    const theme_primary      = isHexColor(dict.theme_primary) ? dict.theme_primary : DEFAULT_PRIMARY;
    const theme_accent       = isHexColor(dict.theme_accent) ? dict.theme_accent : DEFAULT_ACCENT;

    return res.json({
      settings: { cutoff_time, allow_cancel_until, hero_image_url, brand_name, brand_logo_url, theme_primary, theme_accent },
      timezone: process.env.TZ || 'Africa/Casablanca'
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur lecture paramètres publics' });
  }
});

module.exports = router;
