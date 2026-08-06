'use strict';

const { validationResult } = require('express-validator');

/**
 * Middleware à placer après les règles express-validator.
 * Renvoie 400 avec la liste des erreurs si la validation échoue.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Données invalides',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

module.exports = validate;
