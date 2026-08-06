// Formule identique à backend/src/modules/delivery/services/locationService.js
// (haversineMeters) — dupliquée ici volontairement : le calcul distance
// livreur→arrêt se fait côté client (position GPS live, jamais envoyée au
// serveur juste pour ce calcul), pas d'appel réseau pour un simple affichage.
export function haversineKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => v == null)) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Vitesse moyenne estimée deux/trois-roues en ville — approximation grossière
// (pas de moteur de routing réel type OSRM, cohérent avec le reste du module
// delivery qui n'utilise que des distances à vol d'oiseau).
const AVG_SPEED_KMH = 25;

export function estimateEtaMin(distanceKm) {
  if (distanceKm == null) return null;
  return Math.max(1, Math.round((distanceKm / AVG_SPEED_KMH) * 60));
}
