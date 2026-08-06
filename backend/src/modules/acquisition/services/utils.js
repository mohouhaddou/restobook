'use strict';

const EARTH_RADIUS_KM = 6371;

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  return digits.startsWith('00') ? `+${digits.slice(2)}` : digits;
}

function normalizeAddress(value) {
  return normalizeText(value)
    .replace(/\b(avenue|av|rue|route|bd|boulevard)\b/g, '')
    .trim();
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function bboxForRadius(centerLat, centerLng, radiusKm) {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((centerLat * Math.PI) / 180));
  return {
    south: centerLat - latDelta,
    west: centerLng - lngDelta,
    north: centerLat + latDelta,
    east: centerLng + lngDelta,
  };
}

function generateGridCells(scope, maxCells) {
  if (!scope || scope.type !== 'radius') {
    throw new Error('Seul geographicScope.type=radius est supporté en Phase 1');
  }
  const { centerLat, centerLng, radiusKm } = scope;
  const bbox = bboxForRadius(centerLat, centerLng, radiusKm);
  const targetCellKm = radiusKm <= 3 ? 1.5 : 2;
  const rows = Math.max(1, Math.ceil((radiusKm * 2) / targetCellKm));
  const cols = rows;
  const latStep = (bbox.north - bbox.south) / rows;
  const lngStep = (bbox.east - bbox.west) / cols;
  const cells = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const south = bbox.south + r * latStep;
      const north = south + latStep;
      const west = bbox.west + c * lngStep;
      const east = west + lngStep;
      const lat = (south + north) / 2;
      const lng = (west + east) / 2;
      if (haversineKm(centerLat, centerLng, lat, lng) <= radiusKm + targetCellKm) {
        cells.push({
          cellReference: `custom:${centerLat.toFixed(3)}:${centerLng.toFixed(3)}:${r}:${c}`,
          system: 'custom_grid',
          boundary: { type: 'bbox', south, west, north, east },
          centerLat: lat,
          centerLng: lng,
          areaKm2: targetCellKm * targetCellKm,
        });
      }
    }
  }

  if (cells.length > maxCells) {
    throw new Error(`STOP_MAX_CELLS: ${cells.length} cellules estimées pour une limite de ${maxCells}`);
  }
  return cells;
}

function isInsideRadius(scope, lat, lng) {
  if (!scope || scope.type !== 'radius') return false;
  return haversineKm(scope.centerLat, scope.centerLng, Number(lat), Number(lng)) <= scope.radiusKm;
}

function findCellForPoint(cells, lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return (cells || []).find(cell => {
    const boundary = typeof cell.boundary === 'string' ? JSON.parse(cell.boundary) : cell.boundary;
    return boundary && latitude >= boundary.south && latitude <= boundary.north && longitude >= boundary.west && longitude <= boundary.east;
  }) || null;
}

function similarityScore(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftWords = new Set(left.split(' '));
  const rightWords = new Set(right.split(' '));
  const intersection = [...leftWords].filter(word => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size || 1;
  return intersection / union;
}

module.exports = {
  bboxForRadius,
  findCellForPoint,
  generateGridCells,
  haversineKm,
  isInsideRadius,
  normalizeAddress,
  normalizePhone,
  normalizeText,
  similarityScore,
};
