const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ message: 'API works' }));
router.use('/auth', require('./auth'));
router.use('/menu', require('./menu'));
router.use('/reservations', require('./reservations'));
router.use('/admin', require('./admin'));

module.exports = router;
