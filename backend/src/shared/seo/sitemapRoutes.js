'use strict';

const express = require('express');
const router = express.Router();
const { getSitemap, SITEMAP_NAMES } = require('./sitemapService');

router.get(`/:name(${SITEMAP_NAMES.join('|').replace(/\./g, '\\.')})`, async (req, res, next) => {
  try {
    const xml = await getSitemap(req.params.name);
    if (!xml) return next();
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=1800');
    res.send(xml);
  } catch (e) { console.error('[SEO sitemap]', e); next(); }
});

module.exports = router;
