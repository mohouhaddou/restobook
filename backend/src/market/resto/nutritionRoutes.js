'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../../../middleware/validate');
const { requireAuth, requireOrganizationAccess, requirePermission, orgScope } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const { checkFeature } = require('../../../middleware/subscriptionGuard');
const { MenuItem, MenuCategory } = require('../../../models');
const { GOALS, estimateDishNutrition, buildNutritionPrompt } = require('../../../services/AIService');

const router = express.Router();
const GOAL_VALUES = Object.keys(GOALS);

router.use(requireAuth, requireOrganizationAccess, requirePermission(PERMISSIONS.AI_NUTRITION_ANALYZE), checkFeature('has_nutrition_ai'));

function serializeNutrition(item) {
  return {
    id: item.id,
    libelle: item.libelle,
    description: item.description,
    type: item.type,
    category: item.category || null,
    image_url: item.image_url,
    calories: item.calories,
    proteines_g: item.proteines_g === null ? null : Number(item.proteines_g),
    glucides_g: item.glucides_g === null ? null : Number(item.glucides_g),
    lipides_g: item.lipides_g === null ? null : Number(item.lipides_g),
    allergenes: item.allergenes || [],
    health_score: item.health_score,
    nutrition_analysis: item.nutrition_analysis || null,
    nutrition_analyzed_at: item.nutrition_analyzed_at,
  };
}

router.get('/items', async (req, res, next) => {
  try {
    const items = await MenuItem.findAll({
      where: { ...orgScope(req), actif: true },
      include: [{ model: MenuCategory, as: 'category', required: false }],
      order: [['category_id', 'ASC'], ['sort_order', 'ASC'], ['libelle', 'ASC']],
    });
    res.json({ goals: GOALS, items: items.map(serializeNutrition) });
  } catch (e) { next(e); }
});

router.get('/items/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const item = await MenuItem.findOne({
        where: { id: req.params.id, ...orgScope(req), actif: true },
        include: [{ model: MenuCategory, as: 'category', required: false }],
      });
      if (!item) return res.status(404).json({ error: 'Plat introuvable' });
      res.json({ item: serializeNutrition(item), goals: GOALS });
    } catch (e) { next(e); }
  }
);

router.post('/items/:id/analyze',
  [
    param('id').isInt({ min: 1 }),
    body('goal').optional().isIn(GOAL_VALUES),
  ],
  validate,
  async (req, res, next) => {
    try {
      const item = await MenuItem.findOne({ where: { id: req.params.id, ...orgScope(req), actif: true } });
      if (!item) return res.status(404).json({ error: 'Plat introuvable' });

      const goal = req.body.goal || 'balanced';
      const analysis = await estimateDishNutrition({ dish: item, goal });

      item.calories = analysis.calories;
      item.proteines_g = analysis.proteines_g;
      item.glucides_g = analysis.glucides_g;
      item.lipides_g = analysis.lipides_g;
      item.allergenes = analysis.allergenes_potentiels;
      item.health_score = analysis.health_score;
      item.nutrition_analysis = analysis;
      item.nutrition_analyzed_at = new Date();
      await item.save();

      res.json({
        item: serializeNutrition(item),
        analysis,
        prompt: buildNutritionPrompt({ dish: item, goal }),
      });
    } catch (e) { next(e); }
  }
);

module.exports = router;
