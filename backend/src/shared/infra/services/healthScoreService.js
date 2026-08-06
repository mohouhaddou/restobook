'use strict';

/**
 * Score de Santé Infrastructure — formule pondérée réelle et déterministe
 * (jamais un chiffre statique). Chaque pénalité est calculée à partir d'une
 * métrique effectivement mesurée par les collectors ; `breakdown` est renvoyé
 * pour que l'UI puisse justifier le score ("pourquoi ce chiffre ?").
 */

function linearPenalty(value, safeBelow, maxAt, weight) {
  if (value == null) return 0;
  if (value < safeBelow) return 0;
  if (value >= maxAt) return weight;
  return Number((weight * (value - safeBelow) / (maxAt - safeBelow)).toFixed(2));
}

function computeHealthScore({ cpu_pct, mem_pct, disk_pct, services_online, services_total, db_up, ssl_days_remaining }) {
  const cpu_penalty      = linearPenalty(cpu_pct, 60, 90, 25);
  const ram_penalty      = linearPenalty(mem_pct, 70, 95, 25);
  const disk_penalty     = linearPenalty(disk_pct, 75, 95, 15);
  const services_penalty = services_total > 0
    ? Number((20 * ((services_total - services_online) / services_total)).toFixed(2))
    : 0;
  const db_penalty  = db_up === false ? 10 : 0;
  const ssl_penalty = ssl_days_remaining == null ? 0 : ssl_days_remaining < 15 ? 5 : ssl_days_remaining < 30 ? 2 : 0;

  const totalPenalty = cpu_penalty + ram_penalty + disk_penalty + services_penalty + db_penalty + ssl_penalty;
  const score = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));
  const color = score >= 80 ? 'green' : score >= 50 ? 'orange' : 'red';
  const label = score >= 80 ? 'Excellent' : score >= 50 ? 'Attention requise' : 'Critique';

  return {
    score, color, label,
    breakdown: { cpu_penalty, ram_penalty, disk_penalty, services_penalty, db_penalty, ssl_penalty },
  };
}

module.exports = { computeHealthScore };
