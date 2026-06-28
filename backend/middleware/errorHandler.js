'use strict';

/**
 * Gestionnaire d'erreurs centralisé Express (4 arguments).
 * Attrape toutes les erreurs non gérées dans les routes.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  const message = err.expose !== false && err.message
    ? err.message
    : 'Erreur interne du serveur';

  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} — ${err.message}`, err.stack);
  }

  if (res.headersSent) return next(err);
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
