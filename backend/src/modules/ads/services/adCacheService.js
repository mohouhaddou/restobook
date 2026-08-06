'use strict';

// Cache mémoire process-local, TTL court — évite une jointure+filtrage complet
// à chaque résolution d'annonce (potentiellement plusieurs par page vue).
// Invalidé explicitement par toute mutation SuperAdmin (create/update/delete/
// activate/suspend d'une campagne ou d'un placement).
const TTL_MS = 30 * 1000;
const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { store.delete(key); return undefined; }
  return entry.data;
}

function set(key, data) {
  store.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

function invalidate(key) {
  if (key) store.delete(key);
}

function invalidateAll() {
  store.clear();
}

module.exports = { get, set, invalidate, invalidateAll };
