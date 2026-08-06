'use strict';

const endpointManager = require('./overpassEndpointManager');
const {
  buildGroupedQuery,
  classificationTags,
  normalizedCategoryFromTags,
  sourceCategoryFromTags,
} = require('./overpassQueryPlanner');

const OVERPASS_REQUEST_TIMEOUT_MS = Number(process.env.OVERPASS_REQUEST_TIMEOUT_MS || process.env.OVERPASS_TIMEOUT_MS || 60000);
const MAX_OVERPASS_RETRIES = Number(process.env.MAX_OVERPASS_RETRIES || 2);
const OVERPASS_RETRY_BASE_DELAY_MS = Number(process.env.OVERPASS_RETRY_BASE_DELAY_MS || 30000);
const OVERPASS_RETRY_MAX_DELAY_MS = Number(process.env.OVERPASS_RETRY_MAX_DELAY_MS || 180000);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jitterDelay(attempt) {
  const base = Math.min(OVERPASS_RETRY_MAX_DELAY_MS, OVERPASS_RETRY_BASE_DELAY_MS * (2 ** Math.max(0, attempt - 1)));
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

function overpassError(message, code, status = null, permanent = false, reducible = false) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.permanent = permanent;
  error.reducible = reducible;
  return error;
}

async function fetchOverpass({ endpoint, query }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OVERPASS_REQUEST_TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'user-agent': 'iFilino-Knowledge-Acquisition-Engine/0.2 contact:admin@ifilino.local',
      },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });
    const text = await response.text();
    const durationMs = Date.now() - started;
    return {
      ok: response.ok,
      status: response.status,
      durationMs,
      text,
      headers: {
        contentType: response.headers.get('content-type'),
        retryAfter: response.headers.get('retry-after'),
      },
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    if (error.name === 'AbortError') {
      throw overpassError('Overpass timeout', 'OSM_OVERPASS_TIMEOUT', null, false, true);
    }
    const wrapped = overpassError(error.message, 'FETCH_ERROR', null, false, false);
    wrapped.durationMs = durationMs;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }
}

function classifyHttpError(status) {
  if (status === 400) return overpassError('Overpass HTTP 400', 'HTTP_400', status, true, false);
  if (status === 429) return overpassError('Overpass HTTP 429', 'HTTP_429', status, false, false);
  if (status === 504) return overpassError('Overpass HTTP 504', 'HTTP_504', status, false, true);
  if (status === 502 || status === 503) return overpassError(`Overpass HTTP ${status}`, `HTTP_${status}`, status, false, false);
  return overpassError(`Overpass HTTP ${status}`, `HTTP_${status}`, status, status >= 400 && status < 500, false);
}

function addressFromTags(tags = {}) {
  return [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:neighbourhood'],
    tags['addr:city'],
  ].filter(Boolean).join(' ');
}

function websiteFromTags(tags = {}) {
  return tags.website || tags['contact:website'] || null;
}

function phoneFromTags(tags = {}) {
  return tags.phone || tags['contact:phone'] || null;
}

function sourceUrlFor(element) {
  return `https://www.openstreetmap.org/${element.type}/${element.id}`;
}

function parseElements(payload, categories) {
  return (payload.elements || []).map(element => {
    const tags = element.tags || {};
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    const sourceCategory = sourceCategoryFromTags(tags);
    const normalizedCategory = normalizedCategoryFromTags(tags, categories);
    if (lat == null || lng == null) {
      return {
        rejected: true,
        rejectReason: 'MISSING_COORDINATES',
        osmType: element.type,
        osmId: element.id,
      };
    }
    if (!tags.name) {
      return {
        rejected: true,
        rejectReason: 'MISSING_NAME',
        osmType: element.type,
        osmId: element.id,
        latitude: Number(lat),
        longitude: Number(lng),
      };
    }
    return {
      externalId: `${element.type}/${element.id}`,
      osmType: element.type,
      osmId: String(element.id),
      rawName: tags.name,
      rawAddress: addressFromTags(tags) || null,
      latitude: Number(lat),
      longitude: Number(lng),
      sourceCategory,
      normalizedCategory,
      probableCategory: normalizedCategory,
      classificationTags: classificationTags(tags),
      rawOsmTags: {
        amenity: tags.amenity || null,
        shop: tags.shop || null,
        name: tags.name || null,
        phone: tags.phone || tags['contact:phone'] || null,
        website: tags.website || tags['contact:website'] || null,
        address: addressFromTags(tags) || null,
      },
      completenessStatus: addressFromTags(tags) ? 'complete' : 'incomplete',
      phone: phoneFromTags(tags),
      website: websiteFromTags(tags),
      sourceUrl: sourceUrlFor(element),
    };
  });
}

async function executePlan(plan) {
  const query = buildGroupedQuery({ bbox: plan.bbox, categories: plan.categories });
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_OVERPASS_RETRIES; attempt += 1) {
    const endpointState = endpointManager.selectEndpoint();
    const endpoint = endpointState.url;
    try {
      const response = await fetchOverpass({ endpoint, query });
      if (!response.ok) {
        const error = classifyHttpError(response.status);
        error.responseText = response.text.slice(0, 1000);
        error.durationMs = response.durationMs;
        endpointManager.recordError(endpoint, error.code, response.durationMs);
        throw error;
      }
      let payload;
      try {
        payload = JSON.parse(response.text);
      } catch {
        const error = overpassError('Overpass JSON invalide', 'OSM_INVALID_JSON', response.status, false, false);
        error.durationMs = response.durationMs;
        endpointManager.recordError(endpoint, error.code, response.durationMs);
        throw error;
      }
      endpointManager.recordSuccess(endpoint, response.durationMs);
      return {
        endpoint,
        query,
        status: response.status,
        durationMs: response.durationMs,
        rawCount: Array.isArray(payload.elements) ? payload.elements.length : 0,
        elements: parseElements(payload, plan.categories),
        rawPayload: payload,
        meta: {
          endpoint,
          status: response.status,
          durationMs: response.durationMs,
          headers: response.headers,
          queryVersion: plan.queryVersion,
          mode: plan.mode,
          cellIds: plan.cellIds,
          categories: plan.categories,
        },
      };
    } catch (error) {
      lastError = error;
      if (error.permanent || error.reducible || attempt >= MAX_OVERPASS_RETRIES) throw error;
      await sleep(jitterDelay(attempt + 1));
    }
  }

  throw lastError || overpassError('Overpass failed', 'OSM_OVERPASS_ERROR');
}

module.exports = {
  executePlan,
  parseElements,
};
