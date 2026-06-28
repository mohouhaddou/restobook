'use strict';

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ message: 'RestoBook API v2' }));
router.use('/auth',        require('./auth'));
router.use('/menu',        require('./menu'));
router.use('/nutrition',   require('./nutrition'));
router.use('/satisfaction', require('./satisfaction'));
router.use('/reservations', require('./reservations'));
router.use('/admin',       require('./admin'));
router.use('/superadmin',  require('./superadmin'));
router.use('/stats',       require('./stats'));
router.use('/orders',      require('./orders'));
router.use('/tables',      require('./tables'));
router.use('/pub',         require('./publicMenu'));
router.use('/marketplace', require('./marketplace'));
router.use('/restaurant',  require('./restaurantDashboard'));
router.use('/restaurant-saas', require('./restaurantSaas'));
router.use('/delivery',    require('./delivery'));
router.use('/canteen',     require('./canteen'));
router.use('/business',   require('./businessDashboard'));
router.use('/loyalty',    require('./loyalty'));
// ── Nouveaux endpoints domaine séparés ──────────────────────────────────────
router.use('/canteens',      require('./canteens'));      // /api/canteens/*
router.use('/restaurants',   require('./restaurants'));   // /api/restaurants/*
router.use('/notifications', require('./notifications')); // /api/notifications/*

module.exports = router;
