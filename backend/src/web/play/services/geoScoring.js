'use strict';

const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Score plein dans le rayon de tolérance, décroissance linéaire jusqu'à 0 à maxRangeKm.
function guessPlaceScore(distanceKm, toleranceKm = 5, maxRangeKm = 300) {
  if (distanceKm <= toleranceKm) return 100;
  if (distanceKm >= maxRangeKm) return 0;
  const decayRange = maxRangeKm - toleranceKm;
  return Math.round(100 * (1 - (distanceKm - toleranceKm) / decayRange));
}

module.exports = { haversineKm, guessPlaceScore };
