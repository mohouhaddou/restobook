'use strict';

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Organization, MenuItem, DailyMenu, DailyMenuItem, Reservation, Setting } = require('../models');

/* ── GET /api/pub/:slug/info — Infos publiques de l'organisation ─────────── */
router.get('/:slug/info', async (req, res, next) => {
  try {
    const org = await Organization.findOne({
      where: { slug: req.params.slug, active: true },
      attributes: ['id','slug','name','type','settings']
    });
    if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });

    const settings = await Setting.findAll({
      where: { organization_id: org.id },
      attributes: ['key','value']
    });
    const dict = Object.fromEntries(settings.map(s => [s.key, s.value]));

    res.json({
      slug: org.slug,
      name: org.name,
      type: org.type,
      cutoff_time:       dict.cutoff_time        || '10:30',
      allow_cancel_until: dict.allow_cancel_until || '10:00',
      hero_image_url:    dict.hero_image_url      || null,
      description:       dict.description         || null,
      address:           dict.address             || null,
      phone:             dict.phone               || null,
      hours:             dict.hours               || null,
    });
  } catch (e) { next(e); }
});

/* ── GET /api/pub/:slug/menu — Menu du jour public (sans auth) ──────────── */
router.get('/:slug/menu', async (req, res, next) => {
  try {
    const org = await Organization.findOne({ where: { slug: req.params.slug, active: true } });
    if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });

    const date = req.query.date || new Date().toISOString().slice(0,10);

    const daily = await DailyMenu.findOne({
      where: { date_jour: date, organization_id: org.id }
    });

    if (!daily) return res.json({ date_jour: date, locked: false, items: [] });

    const list = await DailyMenuItem.findAll({
      where: { daily_menu_id: daily.id },
      include: [{ model: MenuItem, as: 'menu_item', attributes: ['id','libelle','description','type','image_url','prix','allergenes','calories'] }],
      order: [['id','ASC']]
    });

    const reservations = await Reservation.findAll({
      where: { date_jour: date, status: 'confirmed', organization_id: org.id },
      attributes: ['menu_item_id']
    });
    const counts = {};
    reservations.forEach(r => { counts[r.menu_item_id] = (counts[r.menu_item_id] || 0) + 1; });

    const items = list.map(dmi => {
      const mi    = dmi.menu_item;
      const quota = dmi.stock_quota;
      const used  = counts[mi.id] || 0;
      return {
        id:          mi.id,
        libelle:     mi.libelle,
        description: mi.description || null,
        type:        mi.type,
        image_url:   mi.image_url || null,
        prix:        mi.prix      || null,
        allergenes:  mi.allergenes || null,
        calories:    mi.calories  || null,
        restant:     quota === null ? null : Math.max(quota - used, 0),
        disponible:  quota === null ? true : (quota - used) > 0,
      };
    });

    res.json({ date_jour: date, locked: daily.locked, org: { name: org.name, slug: org.slug }, items });
  } catch (e) { next(e); }
});

/* ── GET /api/pub/:slug/categories — Catégories de plats restaurant ─────── */
router.get('/:slug/categories', async (req, res, next) => {
  try {
    const org = await Organization.findOne({ where: { slug: req.params.slug, active: true } });
    if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });

    // Pour un restaurant, retourner tous les plats actifs groupés par type
    const items = await MenuItem.findAll({
      where: { organization_id: org.id, actif: true },
      order: [['type','ASC'],['libelle','ASC']],
      attributes: ['id','libelle','description','type','image_url','prix','allergenes','calories'],
    });

    // Grouper par type
    const grouped = {};
    for (const it of items) {
      if (!grouped[it.type]) grouped[it.type] = [];
      grouped[it.type].push(it);
    }

    res.json({ org: { name: org.name, type: org.type }, menu: grouped });
  } catch (e) { next(e); }
});

module.exports = router;
