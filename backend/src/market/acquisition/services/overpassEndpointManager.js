'use strict';

const DEFAULT_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const endpoints = (process.env.OVERPASS_ENDPOINTS || process.env.OVERPASS_URL || DEFAULT_ENDPOINTS.join(','))
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const states = new Map(endpoints.map(url => [url, {
  url,
  state: 'HEALTHY',
  requests: 0,
  successes: 0,
  errorsByCode: {},
  averageDurationMs: 0,
  consecutiveTransientErrors: 0,
  lastSuccessAt: null,
  lastErrorAt: null,
  cooldownUntil: null,
}]));

function now() {
  return Date.now();
}

function isTransient(code) {
  return ['HTTP_429', 'HTTP_502', 'HTTP_503', 'HTTP_504', 'OSM_OVERPASS_TIMEOUT', 'OSM_INVALID_JSON', 'FETCH_ERROR'].includes(code);
}

function selectEndpoint() {
  const timestamp = now();
  for (const state of states.values()) {
    if (state.state === 'COOLDOWN' && state.cooldownUntil && timestamp >= state.cooldownUntil) {
      state.state = 'DEGRADED';
      state.cooldownUntil = null;
      state.consecutiveTransientErrors = 0;
    }
  }
  return [...states.values()].find(state => ['HEALTHY', 'DEGRADED'].includes(state.state))
    || [...states.values()].find(state => state.state === 'COOLDOWN')
    || [...states.values()][0];
}

function recordSuccess(url, durationMs) {
  const state = states.get(url);
  if (!state) return;
  state.requests += 1;
  state.successes += 1;
  state.consecutiveTransientErrors = 0;
  state.lastSuccessAt = new Date().toISOString();
  state.state = 'HEALTHY';
  state.averageDurationMs = state.averageDurationMs
    ? Math.round((state.averageDurationMs * (state.successes - 1) + durationMs) / state.successes)
    : durationMs;
}

function recordError(url, code, durationMs = 0) {
  const state = states.get(url);
  if (!state) return;
  state.requests += 1;
  state.errorsByCode[code] = (state.errorsByCode[code] || 0) + 1;
  state.lastErrorAt = new Date().toISOString();
  if (durationMs) {
    const total = Math.max(1, state.requests);
    state.averageDurationMs = state.averageDurationMs
      ? Math.round((state.averageDurationMs * (total - 1) + durationMs) / total)
      : durationMs;
  }
  if (isTransient(code)) {
    state.consecutiveTransientErrors += 1;
    state.state = state.consecutiveTransientErrors >= 3 ? 'COOLDOWN' : 'DEGRADED';
    if (state.state === 'COOLDOWN') {
      state.cooldownUntil = now() + Number(process.env.OVERPASS_CIRCUIT_COOLDOWN_MS || 180000);
    }
  } else {
    state.state = 'DEGRADED';
  }
}

function getEndpointStats() {
  return [...states.values()].map(state => ({
    ...state,
    cooldownUntil: state.cooldownUntil ? new Date(state.cooldownUntil).toISOString() : null,
  }));
}

function resetEndpointStats() {
  for (const [url] of states) {
    states.set(url, {
      url,
      state: 'HEALTHY',
      requests: 0,
      successes: 0,
      errorsByCode: {},
      averageDurationMs: 0,
      consecutiveTransientErrors: 0,
      lastSuccessAt: null,
      lastErrorAt: null,
      cooldownUntil: null,
    });
  }
}

module.exports = {
  getEndpointStats,
  recordError,
  recordSuccess,
  resetEndpointStats,
  selectEndpoint,
};
