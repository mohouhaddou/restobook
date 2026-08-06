'use strict';

const GOALS = Object.freeze({
  weight_loss: 'perte de poids',
  muscle_gain: 'prise de muscle',
  balanced: 'alimentation equilibree',
  light_meal: 'repas leger',
  diabetes_or_restriction: 'diabete ou restriction alimentaire',
});

const ALLERGEN_KEYWORDS = [
  { pattern: /\b(lait|fromage|creme|beurre|yaourt|cheese)\b/i, label: 'lait' },
  { pattern: /\b(oeuf|œuf|mayonnaise)\b/i, label: 'oeufs' },
  { pattern: /\b(bl[eé]|pain|p[aâ]te|pates|pizza|semoule|couscous|farine)\b/i, label: 'gluten' },
  { pattern: /\b(arachide|cacahu[eè]te|peanut)\b/i, label: 'arachides' },
  { pattern: /\b(amande|noix|noisette|pistache|cajou)\b/i, label: 'fruits a coque' },
  { pattern: /\b(crevette|crabe|homard|langouste)\b/i, label: 'crustaces' },
  { pattern: /\b(poisson|thon|saumon|sardine|merlu)\b/i, label: 'poisson' },
  { pattern: /\b(soja|tofu|soy)\b/i, label: 'soja' },
  { pattern: /\b(sesame|sésame)\b/i, label: 'sesame' },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

function textForDish(dish) {
  return `${dish.libelle || ''} ${dish.type || ''} ${dish.description || ''}`.toLowerCase();
}

function detectAllergens(text) {
  return [...new Set(ALLERGEN_KEYWORDS.filter(rule => rule.pattern.test(text)).map(rule => rule.label))];
}

function estimateMacros(dish) {
  const text = textForDish(dish);
  let calories = dish.type === 'dessert' ? 420 : dish.type === 'boisson' ? 140 : dish.type === 'entrée' ? 230 : 560;
  let proteins = dish.type === 'plat' ? 24 : dish.type === 'entrée' ? 8 : 4;
  let carbs = dish.type === 'dessert' ? 58 : dish.type === 'boisson' ? 28 : dish.type === 'entrée' ? 18 : 55;
  let fats = dish.type === 'dessert' ? 18 : dish.type === 'boisson' ? 1 : dish.type === 'entrée' ? 12 : 22;

  const proteinBoost = [
    ['poulet', 10], ['dinde', 10], ['boeuf', 9], ['bœuf', 9], ['viande', 8],
    ['poisson', 9], ['thon', 10], ['saumon', 10], ['oeuf', 6], ['œuf', 6],
    ['lentille', 8], ['pois chiche', 8], ['haricot', 7], ['tofu', 9],
  ];
  for (const [word, boost] of proteinBoost) {
    if (text.includes(word)) proteins += boost;
  }

  if (/\b(frit|frite|pan[eé]|beignet|burger|pizza|sauce|creme|fromage)\b/i.test(text)) {
    calories += 170; fats += 12;
  }
  if (/\b(riz|p[aâ]te|pates|pain|semoule|couscous|pomme de terre|sucre|miel)\b/i.test(text)) {
    calories += 110; carbs += 24;
  }
  if (/\b(salade|grill[eé]|vapeur|l[eé]gume|soupe|crudite)\b/i.test(text)) {
    calories -= 90; fats -= 5; carbs -= 8;
  }
  if (/\b(chocolat|gateau|g[aâ]teau|tarte|glace|patisserie|pâtisserie)\b/i.test(text)) {
    calories += 150; carbs += 28; fats += 8;
  }

  return {
    calories: clamp(round(calories), 40, 1400),
    proteines_g: clamp(round(proteins, 1), 0, 120),
    glucides_g: clamp(round(carbs, 1), 0, 180),
    lipides_g: clamp(round(fats, 1), 0, 100),
  };
}

function computeHealthScore(macros, allergens, dish) {
  const text = textForDish(dish);
  let score = 72;
  if (macros.calories > 800) score -= 18;
  else if (macros.calories > 600) score -= 8;
  if (macros.proteines_g >= 25) score += 8;
  if (macros.lipides_g > 30) score -= 10;
  if (macros.glucides_g > 80) score -= 8;
  if (/\b(salade|vapeur|legume|légume|grill[eé]|soupe)\b/i.test(text)) score += 12;
  if (/\b(frit|frite|beignet|sucre|creme|fromage|sauce)\b/i.test(text)) score -= 12;
  if (allergens.length >= 3) score -= 4;
  return clamp(round(score), 1, 100);
}

function goalRecommendation(goal, macros, allergens, healthScore) {
  const label = GOALS[goal] || GOALS.balanced;
  const notes = [];

  if (goal === 'weight_loss') {
    notes.push(macros.calories <= 450 ? 'Compatible avec un objectif de perte de poids en portion standard.' : 'A consommer en portion reduite ou avec un accompagnement leger.');
    if (macros.lipides_g > 25) notes.push('Limiter les sauces et fritures pour reduire les lipides.');
  } else if (goal === 'muscle_gain') {
    notes.push(macros.proteines_g >= 25 ? 'Bon apport proteique pour la prise de muscle.' : 'Ajouter une source proteique peut ameliorer ce repas.');
    if (macros.calories < 500) notes.push('Prevoir un accompagnement complet si le besoin calorique est eleve.');
  } else if (goal === 'light_meal') {
    notes.push(macros.calories <= 400 ? 'Repas plutot leger.' : 'Repas potentiellement dense; privilegier une petite portion.');
  } else if (goal === 'diabetes_or_restriction') {
    notes.push(macros.glucides_g <= 35 ? 'Charge glucidique estimee moderee.' : 'Glucides eleves: demander un avis professionnel si diabete ou restriction stricte.');
    if (allergens.length) notes.push(`Verifier les allergenes: ${allergens.join(', ')}.`);
  } else {
    notes.push(healthScore >= 70 ? 'Profil globalement equilibre.' : 'Equilibre perfectible: ajouter legumes, proteines maigres ou reduire sauces/sucres.');
  }

  return { goal, label, advice: notes };
}

function buildNutritionPrompt({ dish, goal }) {
  return [
    'Tu es un assistant nutritionnel pour un SaaS de restauration.',
    'Estime les valeurs nutritionnelles d un plat a partir de son nom, type et description.',
    'Retourne uniquement un JSON strict avec les champs:',
    'calories, proteines_g, glucides_g, lipides_g, allergenes_potentiels, health_score, recommendations.',
    'Les valeurs doivent rester estimatives et non medicales.',
    `Objectif utilisateur: ${GOALS[goal] || GOALS.balanced}.`,
    `Plat: ${dish.libelle || ''}.`,
    `Type: ${dish.type || ''}.`,
    `Description: ${dish.description || ''}.`,
  ].join('\n');
}

async function estimateDishNutrition({ dish, goal = 'balanced' }) {
  const text = textForDish(dish);
  const allergens = detectAllergens(text);
  const macros = estimateMacros(dish);
  const healthScore = computeHealthScore(macros, allergens, dish);
  const recommendation = goalRecommendation(goal, macros, allergens, healthScore);

  return {
    source: 'heuristic-ai-ready',
    prompt: buildNutritionPrompt({ dish, goal }),
    goal,
    calories: macros.calories,
    proteines_g: macros.proteines_g,
    glucides_g: macros.glucides_g,
    lipides_g: macros.lipides_g,
    allergenes_potentiels: allergens,
    health_score: healthScore,
    recommendations: {
      [goal]: recommendation,
      balanced: goalRecommendation('balanced', macros, allergens, healthScore),
      weight_loss: goalRecommendation('weight_loss', macros, allergens, healthScore),
      muscle_gain: goalRecommendation('muscle_gain', macros, allergens, healthScore),
      light_meal: goalRecommendation('light_meal', macros, allergens, healthScore),
      diabetes_or_restriction: goalRecommendation('diabetes_or_restriction', macros, allergens, healthScore),
    },
    disclaimer: 'Estimation indicative basee sur les informations disponibles. Ne remplace pas un avis medical ou nutritionnel professionnel.',
  };
}

module.exports = {
  GOALS,
  buildNutritionPrompt,
  estimateDishNutrition,
};
