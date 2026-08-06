'use strict';

/**
 * src/app.js — Factory Express + Socket.IO
 * Extrait de index.js pour séparer la configuration applicative du démarrage PM2.
 * Conserve la compatibilité totale avec l'entrée PM2 (index.js).
 */

const http    = require('http');
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

function createApp({ allowedOrigins = true } = {}) {
  const app = express();
  const httpServer = http.createServer(app);

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  // ── Rate limiting ──────────────────────────────────────────────────────────
  app.use('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
  }));
  app.use('/api/auth/signup', rateLimit({
    windowMs: 60 * 60 * 1000, max: 5,
    message: { error: "Trop de tentatives d'inscription. Réessayez plus tard." }
  }));
  app.use('/api/auth/google', rateLimit({
    windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Trop de tentatives de connexion Google. Réessayez dans 15 minutes.' }
  }));
  app.use('/api', rateLimit({
    windowMs: 60 * 1000, max: 300,
    skip: (req) => req.path === '/health',
    message: { error: 'Trop de requêtes. Ralentissez.' }
  }));

  // ── Fichiers statiques ─────────────────────────────────────────────────────
  const uploadDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  app.use('/uploads', express.static(uploadDir));
  app.use('/brand',   express.static(path.join(__dirname, '..', 'public', 'brand')));

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.get('/api/health', (req, res) => res.json({ ok: true, version: '3.0.0' }));
  app.use('/api', require('../routes'));
  app.use('/api/notifications', require('./shared/notifications/routes'));
  app.use('/api/subscriptions', require('./shared/admin/subscriptionsRoutes'));
  app.use('/api', require('./market/marketplace/publicRoutes'));

  // ── Error handler ──────────────────────────────────────────────────────────
  app.use(require('./middleware/errorHandler'));

  // ── Socket.IO ──────────────────────────────────────────────────────────────
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
    path: '/socket.io',
  });
  global.io = io;

  io.on('connection', (socket) => {
    socket.on('restaurant:join', (orgId) => { if (orgId) socket.join(`org:${orgId}`); });
    socket.on('track:join',      (code)  => { if (code)  socket.join(`track:${String(code).toUpperCase()}`); });
    socket.on('disconnect', () => {});
  });

  return { app, httpServer, io };
}

module.exports = { createApp };
