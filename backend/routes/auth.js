const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

router.post('/login', async (req, res) => {
  try {
    const { matricule, password } = req.body;
    if (!matricule || !password) return res.status(400).json({ error: 'Champs manquants' });
    const user = await User.findOne({ where: { matricule, actif: true } });
    if (!user || !user.hash_mdp) return res.status(401).json({ error: 'Identifiants invalides' });
    const ok = await bcrypt.compare(password, user.hash_mdp);
    if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });
    const token = jwt.sign({ id: user.id, matricule: user.matricule, role: user.role, nom: user.nom }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { matricule: user.matricule, role: user.role, nom: user.nom } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur login' });
  }
});

module.exports = router;
